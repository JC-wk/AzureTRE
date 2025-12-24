import React, { useEffect, useState } from 'react';
import { DetailsList, DetailsListLayoutMode, IColumn, SelectionMode } from '@fluentui/react/lib/DetailsList';
import { PrimaryButton, Dialog, DialogFooter, DialogType, DefaultButton } from '@fluentui/react';
import { useAuthApiCall, HttpMethod, ResultType } from '../../hooks/useAuthApiCall';
import { ApiEndpoint } from '../../models/apiEndpoints';
import { ResourceTemplate } from '../../models/resourceTemplate';

export const TemplateList: React.FunctionComponent = () => {
  const [templates, setTemplates] = useState<ResourceTemplate[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ResourceTemplate | undefined>(undefined);
  const apiCall = useAuthApiCall();

  const fetchTemplates = async () => {
    const result = await apiCall(ApiEndpoint.Templates, HttpMethod.Get, undefined, undefined, ResultType.JSON);
    setTemplates(result.templates);
  };


  useEffect(() => {
    fetchTemplates();
  }, [apiCall]);

  const showDeleteDialog = (template: ResourceTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const hideDeleteDialog = () => {
    setSelectedTemplate(undefined);
    setIsDeleteDialogOpen(false);
  };

  const handleDelete = async (deleteAllVersions: boolean) => {
    if (selectedTemplate) {
      let endpoint = '';
      switch (selectedTemplate.resourceType) {
        case 'workspace':
          endpoint = `${ApiEndpoint.WorkspaceTemplates}/${selectedTemplate.name}`;
          break;
        case 'workspace-service':
          endpoint = `${ApiEndpoint.WorkspaceServiceTemplates}/${selectedTemplate.name}`;
          break;
        case 'shared-service':
          endpoint = `${ApiEndpoint.SharedServiceTemplates}/${selectedTemplate.name}`;
          break;
        case 'user-resource':
          endpoint = `${ApiEndpoint.WorkspaceServiceTemplates}/${selectedTemplate.parentWorkspaceService}/${ApiEndpoint.UserResourceTemplates}/${selectedTemplate.name}`;
          break;
      }

      const version = deleteAllVersions ? '' : `?version=${selectedTemplate.version}`;
      await apiCall(`${endpoint}${version}`, HttpMethod.Delete);
      hideDeleteDialog();
      fetchTemplates();
    }
  };

  const columns: IColumn[] = [
    { key: 'name', name: 'Name', fieldName: 'name', minWidth: 100, maxWidth: 200, isResizable: true },
    { key: 'version', name: 'Version', fieldName: 'version', minWidth: 100, maxWidth: 200, isResizable: true },
    { key: 'description', name: 'Description', fieldName: 'description', minWidth: 200, isResizable: true },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 100,
      maxWidth: 100,
      onRender: (item: ResourceTemplate) => (
        <PrimaryButton text="Delete" onClick={() => showDeleteDialog(item)} />
      ),
    },
  ];

  return (
    <>
      <DetailsList
        items={templates}
        columns={columns}
        setKey="set"
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
      />
      <Dialog
        hidden={!isDeleteDialogOpen}
        onDismiss={hideDeleteDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Delete Template',
          subText: `Are you sure you want to delete the template "${selectedTemplate?.name}"?`,
        }}
        modalProps={{
          isBlocking: true,
        }}
      >
        <DialogFooter>
          <PrimaryButton onClick={() => handleDelete(false)} text="Delete this version" />
          <DefaultButton onClick={() => handleDelete(true)} text="Delete all versions" />
          <DefaultButton onClick={hideDeleteDialog} text="Cancel" />
        </DialogFooter>
      </Dialog>
    </>
  );
};
