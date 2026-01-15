import React, { useEffect, useState } from 'react';
import { Stack, DefaultButton, PrimaryButton, Spinner } from '@fluentui/react';
import { useAuthApiCall, HttpMethod, ResultType } from '../../../hooks/useAuthApiCall';
import semver from 'semver';
import { Workspace } from '../../../models/workspace';
import { SharedService } from '../../../models/sharedService';
import { ResourceType } from '../../../models/resourceType';

interface Template {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  resourceType: string;
  current: boolean;
}

interface TemplatesProps {
  onClose: () => void;
}

const Templates: React.FC<TemplatesProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [inUseTemplates, setInUseTemplates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const api = useAuthApiCall();

  const fetchTemplatesAndWorkspaces = async () => {
    setLoading(true);
    try {
      const [
        workspaceTemplates,
        workspaceServiceTemplates,
        sharedServiceTemplates,
        userResourceTemplates,
        workspaces,
        sharedServices
      ] = await Promise.all([
        api(`${ResourceType.Workspace}-templates`, HttpMethod.Get),
        api(`${ResourceType.WorkspaceService}-templates`, HttpMethod.Get),
        api(`${ResourceType.SharedService}-templates`, HttpMethod.Get),
        api(`${ResourceType.UserResource}-templates`, HttpMethod.Get),
        api('workspaces', HttpMethod.Get),
        api('shared-services', HttpMethod.Get)
      ]);

      const allTemplates = [
        ...(workspaceTemplates.templates || []),
        ...(workspaceServiceTemplates.templates || []),
        ...(sharedServiceTemplates.templates || []),
        ...(userResourceTemplates.templates || [])
      ];

      setTemplates(allTemplates);

      const usedTemplates = new Set<string>();
      if (workspaces && workspaces.workspaces) {
        workspaces.workspaces.forEach((w: Workspace) => {
          if (w.templateName) usedTemplates.add(w.templateName);
        });
      }
      if (sharedServices && sharedServices.sharedServices) {
        sharedServices.sharedServices.forEach((s: SharedService) => {
          if (s.templateName) usedTemplates.add(s.templateName);
        });
      }
      setInUseTemplates(usedTemplates);

    } catch (e) {
      console.error("Error fetching templates or workspaces", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplatesAndWorkspaces();
  }, []);

  const handleDeleteVersion = async (templateId: string, templateName: string, version: string) => {
    let warning = '';
    if (inUseTemplates.has(templateName)) {
      warning = 'This template is in use by at least one workspace. Deleting this version could cause issues if a workspace is using it.\n\n';
    }
    if (!window.confirm(`${warning}Are you sure you want to delete version ${version} of ${templateName}?`)) return;

    try {
      await api(`/templates/${templateId}`, HttpMethod.Delete, undefined, undefined, ResultType.None);
      setTemplates(templates.filter((t) => t.id !== templateId));
    } catch (error) {
      console.error('Failed to delete template version', error);
      alert('Failed to delete template version. See console for details.');
    }
  };

  const handleDeleteAllVersions = async (templateName: string, resourceType: string) => {
    if (inUseTemplates.has(templateName)) {
      alert(`Unable to delete ${templateName} as it is currently in use by one or more workspaces.`);
      return;
    }
    const versionsCount = templates.filter(t => t.name === templateName && t.resourceType === resourceType).length;
    if (!window.confirm(
      `Are you sure you want to delete ALL ${versionsCount} version(s) of ${templateName} (${resourceType})?`
    )) return;

    try {
      await api(`/templates/${resourceType}/${templateName}`, HttpMethod.Delete, undefined, undefined, ResultType.None);
      setTemplates(templates.filter((t) => !(t.name === templateName && t.resourceType === resourceType)));
    } catch (error) {
      console.error('Failed to delete all template versions', error);
      alert('Failed to delete all template versions. See console for details.');
    }
  };

  // Group templates by name and resource type
  const groupedTemplates = templates.reduce((acc, template) => {
    const key = `${template.name}-${template.resourceType}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <Stack className="tre-panel tre-resource-panel">
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <h2 style={{ margin: 0 }}>Template Management</h2>
        <DefaultButton text="Close" onClick={onClose} />
      </Stack>

      <p style={{ color: 'Orange', marginTop: 10 }}>
        Warning: Deleting templates is permanent and cannot be undone. Ensure no resources are using these templates.
      </p>

      {loading && <Spinner label="Loading templates..." />}

      {!loading && templates.length === 0 && (
        <div style={{ marginTop: 20 }}>No templates found.</div>
      )}

      {!loading && templates.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          {Object.entries(groupedTemplates).map(([key, templateVersions]) => {
            const firstTemplate = templateVersions[0];
            const isInUse = inUseTemplates.has(firstTemplate.name);
            return (
              <div key={key} style={{ marginBottom: 30 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                      {firstTemplate.title || firstTemplate.name}
                      {isInUse && (
                        <span style={{
                          backgroundColor: '#edebe9',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          marginLeft: '10px'
                        }}>
                          In Use
                        </span>
                      )}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {firstTemplate.name} ({firstTemplate.resourceType})
                    </div>
                    {firstTemplate.description && (
                      <div style={{ fontSize: '13px', marginTop: 5 }}>
                        {firstTemplate.description}
                      </div>
                    )}
                  </div>
                  <PrimaryButton
                    text={`Delete All ${templateVersions.length} Version(s)`}
                    onClick={() => handleDeleteAllVersions(firstTemplate.name, firstTemplate.resourceType)}
                    styles={{ root: { backgroundColor: isInUse ? '#b3b3b3' : '#a4262c' } }}
                    disabled={isInUse}
                    data-testid={`delete-all-${firstTemplate.name}`}
                  />
                </Stack>

                <table className="tre-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Current</th>
                      <th>ID</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateVersions
                      .sort((a, b) => semver.rcompare(a.version, b.version))
                      .map((template) => (
                        <tr key={template.id}>
                          <td>
                            <strong>{template.version}</strong>
                          </td>
                          <td>
                            {template.current ? (
                              <span style={{ color: 'green', fontWeight: 'bold' }}>✓ Current</span>
                            ) : (
                              <span style={{ color: '#666' }}>-</span>
                            )}
                          </td>
                          <td style={{ fontSize: '11px', color: '#666' }}>
                            {template.id}
                          </td>
                          <td>
                            <DefaultButton
                              text="Delete Version"
                              onClick={() => handleDeleteVersion(template.id, template.name, template.version)}
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </Stack>
  );
};

export default Templates;
