import {
  Dialog,
  DialogFooter,
  PrimaryButton,
  DialogType,
  Spinner,
  Dropdown,
  MessageBar,
  MessageBarType,
  Icon,
  Stack,
} from "@fluentui/react";
import React, { useContext, useState, useEffect, useRef } from "react";
import { AvailableUpgrade, Resource } from "../../models/resource";
import {
  HttpMethod,
  ResultType,
  useAuthApiCall,
} from "../../hooks/useAuthApiCall";
import { WorkspaceContext } from "../../contexts/WorkspaceContext";
import { ResourceType } from "../../models/resourceType";
import { APIError } from "../../models/exceptions";
import { LoadingState } from "../../models/loadingState";
import { ExceptionLayout } from "./ExceptionLayout";
import { useAppDispatch } from "../../hooks/customReduxHooks";
import { addUpdateOperation } from "../shared/notifications/operationsSlice";
import { ResourceForm } from "./create-update-resource/ResourceForm";
import { ApiEndpoint } from "../../models/apiEndpoints";

interface ConfirmUpgradeProps {
  resource: Resource;
  onDismiss: () => void;
}

// Utility to get all property keys from template schema's properties object recursively, flattening nested if needed
const getAllPropertyKeys = (properties: any, prefix = ""): string[] => {
  if (!properties) return [];
  let keys: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (value && typeof value === "object" && 'properties' in value) {
      // recur for nested properties
      keys = keys.concat(getAllPropertyKeys(value["properties"], prefix + key + "."));
    } else {
      keys.push(prefix + key);
    }
  }
  return keys;
};

// Utility to build a reduced schema with only given keys and their nested schema (depth 1), including required
const buildReducedSchema = (fullSchema: any, keys: string[]): any => {
  if (!fullSchema || !fullSchema.properties) return null;
  const reducedProperties: any = {};
  const required: string[] = [];

  keys.forEach((key) => {
    // Only allow top-level property keys (no nested with dots) for simplicity here
    const topKey = key.split('.')[0];
    if (fullSchema.properties[topKey]) {
      if (!reducedProperties[topKey]) {
        reducedProperties[topKey] = fullSchema.properties[topKey];
        if (fullSchema.required && fullSchema.required.includes(topKey)) {
          required.push(topKey);
        }
      }
    }
  });

  return {
    type: "object",
    properties: reducedProperties,
    required: required.length > 0 ? required : undefined,
  };
};

// Utility to collect direct property keys referenced inside conditional schemas
const collectConditionalKeys = (entry: any): string[] => {
  const keys: string[] = [];
  if (!entry) return keys;
  const collect = (schemaPart: any) => {
    if (schemaPart && schemaPart.properties) {
      keys.push(...Object.keys(schemaPart.properties));
    }
  };
  collect(entry.if);
  collect(entry.then);
  collect(entry.else);
  return [...new Set(keys)];
};

// Extract conditional blocks that reference any of the new keys.
const extractConditionalBlocks = (schema: any, newKeys: string[]) => {
  const conditionalEntries: any[] = [];
  if (!schema) return { allOf: [] };
  const allOf = schema.allOf || [];
  allOf.forEach((entry: any) => {
    if (entry && entry.if) {
      const conditionalKeys = collectConditionalKeys(entry);
      // include entry if any conditionalKey matches a new key (top-level match)
      if (conditionalKeys.some((k) => newKeys.some((nk) => nk.split('.')[0] === k))) {
        conditionalEntries.push(entry);
      }
    }
  });
  return { allOf: conditionalEntries };
};

export const ConfirmUpgradeResource: React.FunctionComponent<
  ConfirmUpgradeProps
> = (props: ConfirmUpgradeProps) => {
  const apiCall = useAuthApiCall();
  const [selectedVersion, setSelectedVersion] = useState("");
  const [apiError, setApiError] = useState<APIError | null>(null);
  const [requestLoadingState, setRequestLoadingState] = useState(
    LoadingState.Ok,
  );
  const workspaceCtx = useContext(WorkspaceContext);
  const dispatch = useAppDispatch();
  const formRef = useRef<any>();

  const [newPropertiesToFill, setNewPropertiesToFill] = useState<string[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [newTemplateSchema, setNewTemplateSchema] = useState<any | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);

  const upgradeProps = {
    type: DialogType.normal,
    title: `Upgrade Template Version?`,
    closeButtonAriaLabel: "Close",
    subText: `Are you sure you want upgrade the template version of ${props.resource.properties.display_name} from version ${props.resource.templateVersion}?`,
  };

  const dialogStyles = { main: { maxWidth: 450 } };
  const modalProps = {
    titleAriaId: "labelId",
    subtitleAriaId: "subTextId",
    isBlocking: true,
    styles: dialogStyles,
  };

  const wsAuth =
    props.resource.resourceType === ResourceType.WorkspaceService ||
    props.resource.resourceType === ResourceType.UserResource;

  // Fetch new template schema and identify new properties missing in current resource
  useEffect(() => {
    if (!selectedVersion) {
      setNewPropertiesToFill([]);
      setNewPropertyValues({});
      setNewTemplateSchema(null);
      return;
    }

    const fetchNewTemplateSchema = async () => {
      setLoadingSchema(true);
      setApiError(null);
      try {
        let fetchUrl = "";
        switch (props.resource.resourceType) {
          case ResourceType.Workspace:
            fetchUrl = `${ApiEndpoint.WorkspaceTemplates}/${props.resource.templateName}?version=${selectedVersion}`;
            break;
          case ResourceType.WorkspaceService:
            fetchUrl = `${ApiEndpoint.WorkspaceServiceTemplates}/${props.resource.templateName}?version=${selectedVersion}`;
            break;
          case ResourceType.SharedService:
            fetchUrl = `${ApiEndpoint.SharedServiceTemplates}/${props.resource.templateName}?version=${selectedVersion}`;
            break;
          default:
            throw Error("Unsupported resource type.");
        }

        const res = await apiCall(
          fetchUrl,
          HttpMethod.Get,
          wsAuth ? workspaceCtx.workspaceApplicationIdURI : undefined,
          undefined,
          ResultType.JSON,
        );

        // Use full fetched schema from API
        setNewTemplateSchema(res);

        const newSchemaProps = res?.properties || {};
        const currentProps = props.resource.properties || {};

        const newKeys = getAllPropertyKeys(newSchemaProps);
        const currentKeys = getAllPropertyKeys(currentProps);

        const newPropKeys = newKeys.filter((k) => !currentKeys.includes(k));

        setNewPropertiesToFill(newPropKeys);

        // prefill newPropertyValues with schema defaults or empty string
        setNewPropertyValues(
          newPropKeys.reduce((acc, key) => {
            // Get top-level portion of the key
            const topKey = key.split('.')[0];
            const defaultValue = res?.properties?.[topKey]?.default;
            acc[key] = defaultValue !== undefined ? defaultValue : '';
            return acc;
          }, {} as any),
        );
      } catch (err: any) {
        if (!err.userMessage) {
          err.userMessage = "Failed to fetch new template schema";
        }
        setApiError(err);
      } finally {
        setLoadingSchema(false);
      }
    };

    fetchNewTemplateSchema();
  }, [selectedVersion, apiCall, props.resource]);

  const upgradeCall = async (op: any) => {
    if (op) {
      dispatch(addUpdateOperation(op));
      props.onDismiss();
    }
  };

  // Use buildReducedSchema to include only new properties
  const reducedSchemaProperties = newTemplateSchema
    ? buildReducedSchema(newTemplateSchema, newPropertiesToFill)
    : null;

  // Extract any conditional blocks from full schema, filtered by new properties
  const conditionalBlocks = newTemplateSchema ? extractConditionalBlocks(newTemplateSchema, newPropertiesToFill) : {};

  // Compose final schema combining reduced properties with conditional blocks
  const finalSchema = reducedSchemaProperties
    ? { ...reducedSchemaProperties, ...conditionalBlocks }
    : null;

  // UI schema override: hide the form's submit button because we use external Upgrade button
  // start with existing UI order and classNames from full schema uiSchema
  const baseUiSchema = newTemplateSchema?.uiSchema || {};

  // Compose final uiSchema merging baseUiSchema with our overrides
  const uiSchema = {
    ...baseUiSchema,
    "ui:submitButtonOptions": { norender: true },
    // overview: { "ui:widget": "textarea" },
  };

  const onRenderOption = (option: any): JSX.Element => {
    return (
      <div>
        {option.data && option.data.icon && (
          <Icon
            style={{ marginRight: "8px" }}
            iconName={option.data.icon}
            aria-hidden="true"
            title={option.data.icon}
          />
        )}
        <span>{option.text}</span>
      </div>
    );
  };

  const convertToDropDownOptions = (upgrade: Array<AvailableUpgrade>) => {
    return upgrade.map((upgrade) => ({
      key: upgrade.version,
      text: upgrade.version,
      data: { icon: upgrade.forceUpdateRequired ? "Warning" : "" },
    }));
  };

  const getDropdownOptions = () => {
    const options = [];
    const nonMajorUpgrades = props.resource.availableUpgrades.filter(
      (upgrade) => !upgrade.forceUpdateRequired,
    );
    options.push(...convertToDropDownOptions(nonMajorUpgrades));
    return options;
  };

  return (
    <>
      <Dialog
        hidden={false}
        onDismiss={() => props.onDismiss()}
        dialogContentProps={upgradeProps}
        modalProps={modalProps}
      >
        {requestLoadingState === LoadingState.Ok && (
          <>
            <MessageBar messageBarType={MessageBarType.warning}>
              Upgrading the template version is irreversible.
            </MessageBar>

            {loadingSchema && <Spinner label="Loading new template schema..." />}

            {!loadingSchema && newPropertiesToFill.length > 0 && (
              <Stack tokens={{ childrenGap: 15 }}>
                <MessageBar messageBarType={MessageBarType.info} styles={{ root: { marginBottom: 25 } }}>
                  You must specify values for new properties:
                </MessageBar>

                {finalSchema && (
                  <ResourceForm
                    templateName={props.resource.templateName}
                    schema={finalSchema}
                    updateResource={props.resource}
                    onCreateResource={(op, _) => upgradeCall(op)}
                    formRef={formRef}
                    hideSubmitButton={true}
                    isUpgrade={true}
                    overrideTemplateVersion={selectedVersion}
                    onFormValidated={setIsFormValid}
                  />
                )}
              </Stack>
            )}

            <DialogFooter>
              <Dropdown
                placeholder="Select Version"
                options={getDropdownOptions()}
                onRenderOption={onRenderOption}
                styles={{ dropdown: { width: 125 } }}
                onChange={(event, option) => {
                  option && setSelectedVersion(option.text);
                }}
                selectedKey={selectedVersion}
              />
              <PrimaryButton
                primaryDisabled={!selectedVersion || (newPropertiesToFill.length > 0 && !isFormValid)}
                text="Upgrade"
                onClick={() => formRef.current.submit()}
              />
            </DialogFooter>
          </>
        )}
        {requestLoadingState === LoadingState.Loading && (
          <Spinner
            label="Sending request..."
            ariaLive="assertive"
            labelPosition="right"
          />
        )}
        {requestLoadingState === LoadingState.Error && (
          <ExceptionLayout e={apiError ?? ({} as APIError)} />
        )}
      </Dialog>
    </>
  );
};
