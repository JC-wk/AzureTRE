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
} from "@fluentui/react";
import React, { useContext, useState, useRef } from "react";
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

  const upgradeCall = async (op: any) => {
    if (op) {
      dispatch(addUpdateOperation(op));
    }
    props.onDismiss();
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

  // Construct API paths for templates of specified resourceType
  let templatePath;
  switch (props.resource.resourceType) {
    case ResourceType.Workspace:
      templatePath = `${ApiEndpoint.WorkspaceTemplates}/${props.resource.templateName}`;
      break;
    case ResourceType.WorkspaceService:
      templatePath = `${ApiEndpoint.WorkspaceServiceTemplates}/${props.resource.templateName}`;
      break;
    case ResourceType.SharedService:
      templatePath = `${ApiEndpoint.SharedServiceTemplates}/${props.resource.templateName}`;
      break;
    default:
      throw Error("Unsupported resource type.");
  }

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

            {
              selectedVersion && <ResourceForm
                templateName={props.resource.templateName}
                templatePath={templatePath}
                resourcePath={props.resource.resourcePath}
                updateResource={props.resource}
                onCreateResource={(op) => upgradeCall(op)}
                workspaceApplicationIdURI={wsAuth ? workspaceCtx.workspaceApplicationIdURI : undefined}
                formRef={formRef}
                hideSubmitButton={true}
                overrideTemplateVersion={selectedVersion}
                isUpgrade={true}
              />
            }

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
                primaryDisabled={!selectedVersion}
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
