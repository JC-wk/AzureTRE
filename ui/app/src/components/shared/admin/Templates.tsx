import React, { useEffect, useState } from 'react';
import { Stack, DefaultButton, PrimaryButton, Spinner, TooltipHost, DirectionalHint } from '@fluentui/react';
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

interface TemplateUsage {
  id: string;
  displayName?: string;
  resourceType: string;
  templateName: string;
  templateVersion: string;
}

interface TemplatesProps {
  onClose: () => void;
}

const Templates: React.FC<TemplatesProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [inUseTemplates, setInUseTemplates] = useState<Map<string, TemplateUsage[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const api = useAuthApiCall();

  const getTemplateVersionKey = (name: string, version: string) => `${name}::${version}`;

  const fetchTemplatesAndWorkspaces = async () => {
    setLoading(true);
    try {
      const [
        allTemplates,
        templateUsage
      ] = await Promise.all([
        api('templates', HttpMethod.Get),
        api('templates/usage', HttpMethod.Get)
      ]);

      setTemplates(allTemplates || []);

      const usageMap = new Map<string, TemplateUsage[]>();
      if (templateUsage && Array.isArray(templateUsage)) {
        templateUsage.forEach((u: TemplateUsage) => {
          if (u.templateName && u.templateVersion) {
            const key = getTemplateVersionKey(u.templateName, u.templateVersion);
            if (!usageMap.has(key)) {
              usageMap.set(key, []);
            }
            usageMap.get(key)?.push(u);
          }
        });
      }
      setInUseTemplates(usageMap);

    } catch (e) {
      console.error("Error fetching templates or usage", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplatesAndWorkspaces();
  }, []);

  const handleDeleteVersion = async (templateId: string, templateName: string, version: string) => {
    if (inUseTemplates.has(getTemplateVersionKey(templateName, version))) return;

    if (!window.confirm(`Are you sure you want to delete version ${version} of ${templateName}?`)) return;

    try {
      await api(`/templates/${templateId}`, HttpMethod.Delete, undefined, undefined, ResultType.None);
      setTemplates(templates.filter((t) => t.id !== templateId));
    } catch (error) {
      console.error('Failed to delete template version', error);
      alert('Failed to delete template version. See console for details.');
    }
  };

  const handleDeleteAllVersions = async (templateName: string, resourceType: string, versions: Template[]) => {
    const isAnyVersionInUse = versions.some(v => inUseTemplates.has(getTemplateVersionKey(templateName, v.version)));
    
    if (isAnyVersionInUse) {
      alert(`Unable to delete ${templateName} as one or more versions are currently in use.`);
      return;
    }
    const versionsCount = versions.length;
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
            const isAnyVersionInUse = templateVersions.some(v => inUseTemplates.has(getTemplateVersionKey(v.name, v.version)));
            
            return (
              <div key={key} style={{ marginBottom: 30 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                      {firstTemplate.title || firstTemplate.name}
                      {isAnyVersionInUse && (
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
                    onClick={() => handleDeleteAllVersions(firstTemplate.name, firstTemplate.resourceType, templateVersions)}
                    styles={{ root: { backgroundColor: isAnyVersionInUse ? '#b3b3b3' : '#a4262c' } }}
                    disabled={isAnyVersionInUse}
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
                      .map((template) => {
                        const usage = inUseTemplates.get(getTemplateVersionKey(template.name, template.version));
                        const isVersionInUse = usage && usage.length > 0;
                        return (
                        <tr key={template.id}>
                          <td>
                            <strong>{template.version}</strong>
                            {isVersionInUse && (
                              <TooltipHost
                                content={
                                  <ul style={{ margin: 0, paddingInlineStart: '20px' }}>
                                    {usage!.map((u: TemplateUsage) => (
                                      <li key={u.id}>
                                        {u.displayName || u.id} ({u.resourceType})
                                      </li>
                                    ))}
                                  </ul>
                                }
                                directionalHint={DirectionalHint.rightCenter}
                              >
                                <span style={{
                                  backgroundColor: '#edebe9',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  marginLeft: '8px',
                                  verticalAlign: 'middle',
                                  cursor: 'help'
                                }}>
                                  In Use
                                </span>
                              </TooltipHost>
                            )}
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
                              disabled={isVersionInUse}
                              title={isVersionInUse ? "Cannot delete template version in use" : undefined}
                            />
                          </td>
                        </tr>
                      )})}
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
