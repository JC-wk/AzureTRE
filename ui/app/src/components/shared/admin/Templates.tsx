import React, { useEffect, useState } from 'react';
import { DetailsList, DetailsListLayoutMode, SelectionMode, IColumn, CommandBar, ICommandBarItemProps, Text, PrimaryButton, DefaultButton, Dialog, DialogFooter, DialogType } from '@fluentui/react';
import { HttpMethod, useAuthApiCall } from '../../../hooks/useAuthApiCall';
import { ApiEndpoint } from '../../../models/apiEndpoints';
import { ResourceTemplate } from '../../../models/resourceTemplate';

type TemplateGroup = {
  name: string;
  versions: ResourceTemplate[];
  resourceType: string;
  parent?: string;
};

interface TemplatesProps {
  onClose: () => void;
}

const Templates: React.FC<TemplatesProps> = ({ onClose }) => {
  const [templateGroups, setTemplateGroups] = useState<TemplateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogHidden, setDialogHidden] = useState(true);
  const [deleteAction, setDeleteAction] = useState<{ action: () => void } | null>(null);

  const apiCall = useAuthApiCall();

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const [workspaceTemplates, sharedServiceTemplates, workspaceServiceTemplates] = await Promise.all([
        apiCall(ApiEndpoint.WorkspaceTemplates, HttpMethod.Get),
        apiCall(ApiEndpoint.SharedServiceTemplates, HttpMethod.Get),
        apiCall(ApiEndpoint.WorkspaceServiceTemplates, HttpMethod.Get)
      ]);

      const allTemplates: (ResourceTemplate & { parent?: string })[] = [
        ...(workspaceTemplates.templates || []),
        ...(sharedServiceTemplates.templates || []),
        ...(workspaceServiceTemplates.templates || [])
      ];

      // Fetch user resource templates for each workspace service template
      if (workspaceServiceTemplates.templates) {
        const userResourcePromises = workspaceServiceTemplates.templates.map(async template => {
          const result = await apiCall(`${ApiEndpoint.WorkspaceServiceTemplates}/${template.name}/${ApiEndpoint.UserResourceTemplates}`, HttpMethod.Get);
          if (result.templates) {
            return result.templates.map(t => ({ ...t, parent: template.name }));
          }
          return [];
        });
        const userResourceResults = await Promise.all(userResourcePromises);
        userResourceResults.forEach(result => {
          allTemplates.push(...result);
        });
      }

      const grouped = allTemplates.reduce((acc, template) => {
        const group = acc.find(g => g.name === template.name && g.resourceType === template.resourceType);
        if (group) {
          group.versions.push(template);
        } else {
          acc.push({ name: template.name, versions: [template], resourceType: template.resourceType, parent: template.parent });
        }
        return acc;
      }, [] as TemplateGroup[]);

      setTemplateGroups(grouped);
    } catch (error) {
      console.error('Failed to fetch templates', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [apiCall]);

  const showDeleteConfirmation = (action: () => void) => {
    setDeleteAction({ action });
    setDialogHidden(false);
  };

  const performDelete = () => {
    if (deleteAction) {
      deleteAction.action();
    }
    setDialogHidden(true);
    setDeleteAction(null);
  };

  const handleDeleteVersion = (name: string, version: string, resourceType: string, parent?: string) => {
    showDeleteConfirmation(async () => {
      let url = '';
      switch (resourceType) {
        case 'workspace':
          url = `${ApiEndpoint.WorkspaceTemplates}/${name}?version=${version}`;
          break;
        case 'shared-service':
          url = `${ApiEndpoint.SharedServiceTemplates}/${name}?version=${version}`;
          break;
        case 'workspace-service':
          url = `${ApiEndpoint.WorkspaceServiceTemplates}/${name}?version=${version}`;
          break;
        case 'user-resource':
          if (parent) {
            url = `${ApiEndpoint.WorkspaceServiceTemplates}/${parent}/${ApiEndpoint.UserResourceTemplates}/${name}?version=${version}`;
          }
          break;
      }

      if (url) {
        await apiCall(url, HttpMethod.Delete);
        fetchTemplates();
      } else {
        console.error('Could not determine delete url');
      }
    });
  };

  const handleDeleteAll = (name: string, resourceType: string, parent?: string) => {
    showDeleteConfirmation(async () => {
      let url = '';
      switch (resourceType) {
        case 'workspace':
          url = `${ApiEndpoint.WorkspaceTemplates}/${name}`;
          break;
        case 'shared-service':
          url = `${ApiEndpoint.SharedServiceTemplates}/${name}`;
          break;
        case 'workspace-service':
          url = `${ApiEndpoint.WorkspaceServiceTemplates}/${name}`;
          break;
        case 'user-resource':
          if (parent) {
            url = `${ApiEndpoint.WorkspaceServiceTemplates}/${parent}/${ApiEndpoint.UserResourceTemplates}/${name}`;
          }
          break;
      }

      if (url) {
        await apiCall(url, HttpMethod.Delete);
        fetchTemplates();
      } else {
        console.error('Could not determine delete url');
      }
    });
  };

  const columns: IColumn[] = [
    { key: 'name', name: 'Name', fieldName: 'name', minWidth: 150, isResizable: true },
    { key: 'version', name: 'Version', fieldName: 'version', minWidth: 100, isResizable: true },
    { key: 'resourceType', name: 'Type', fieldName: 'resourceType', minWidth: 100, isResizable: true },
    { key: 'current', name: 'Current', fieldName: 'current', minWidth: 50, onRender: (item: ResourceTemplate) => (item.current ? 'Yes' : 'No') },
    {
      key: 'actions', name: 'Actions', minWidth: 200, onRender: (item: ResourceTemplate & { parent?: string }) => (
        <>
          <PrimaryButton text="Delete Version" onClick={() => handleDeleteVersion(item.name, item.version, item.resourceType, item.parent)} styles={{ root: { marginRight: 8 } }} />
        </>
      )
    }
  ];

  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'close',
      text: 'Close',
      iconProps: { iconName: 'Cancel' },
      onClick: onClose,
    },
  ];

  return (
    <>
      <CommandBar items={commandBarItems} />
      <Text variant="xxLarge" style={{ padding: '20px' }}>Registered Templates</Text>
      {templateGroups.map(group => (
        <div key={`${group.name}-${group.resourceType}`} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <Text variant="large" style={{ marginRight: '20px' }}>{group.name} ({group.resourceType})</Text>
            <DefaultButton text="Delete All" onClick={() => handleDeleteAll(group.name, group.resourceType, group.parent)} />
          </div>
          <DetailsList
            items={group.versions}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
            loading={isLoading}
          />
        </div>
      ))}
      <Dialog
        hidden={dialogHidden}
        onDismiss={() => setDialogHidden(true)}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Confirm Deletion',
          subText: 'Are you sure you want to delete this template? This action cannot be undone.',
        }}
        modalProps={{
          isBlocking: true,
        }}
      >
        <DialogFooter>
          <PrimaryButton onClick={performDelete} text="Delete" />
          <DefaultButton onClick={() => setDialogHidden(true)} text="Cancel" />
        </DialogFooter>
      </Dialog>
    </>
  );
};

export default Templates;
