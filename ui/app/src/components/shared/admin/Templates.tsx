import React, { useEffect, useState } from "react";
import {
  Stack,
  DefaultButton,
  PrimaryButton,
  Spinner,
  TooltipHost,
  DirectionalHint,
  SearchBox,
  Icon,
} from "@fluentui/react";
import { useAuthApiCall, HttpMethod, ResultType } from "../../../hooks/useAuthApiCall";
import semver from "semver";
import { ResourceType } from "../../../models/resourceType";

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

const getResourceTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case ResourceType.Workspace.toLowerCase():
      return { bg: "#eff6fc", border: "#0078d4", text: "#0078d4" };
    case ResourceType.WorkspaceService.toLowerCase():
      return { bg: "#f3f2f1", border: "#5c2d91", text: "#5c2d91" };
    case ResourceType.UserResource.toLowerCase():
      return { bg: "#f0fdf4", border: "#166534", text: "#166534" };
    case ResourceType.SharedService.toLowerCase():
      return { bg: "#fff7ed", border: "#c2410c", text: "#c2410c" };
    default:
      return { bg: "#f3f2f1", border: "#605e5c", text: "#605e5c" };
  }
};

const Templates: React.FC<TemplatesProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [inUseTemplates, setInUseTemplates] = useState<Map<string, TemplateUsage[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("all");
  const api = useAuthApiCall();

  const getTemplateVersionKey = (name: string, version: string) => `${name}::${version}`;

  const fetchTemplatesAndWorkspaces = async () => {
    setLoading(true);
    try {
      const [allTemplates, templateUsage] = await Promise.all([
        api("templates", HttpMethod.Get),
        api("templates/usage", HttpMethod.Get),
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
      console.error("Failed to delete template version", error);
      alert("Failed to delete template version. See console for details.");
    }
  };

  const handleDeleteAllVersions = async (templateName: string, resourceType: string, versions: Template[]) => {
    const isAnyVersionInUse = versions.some((v) => inUseTemplates.has(getTemplateVersionKey(templateName, v.version)));

    if (isAnyVersionInUse) {
      alert(`Unable to delete ${templateName} as one or more versions are currently in use.`);
      return;
    }
    const versionsCount = versions.length;
    if (
      !window.confirm(
        `Are you sure you want to delete ALL ${versionsCount} version(s) of ${templateName} (${resourceType})?`,
      )
    )
      return;

    try {
      await api(`/templates/${resourceType}/${templateName}`, HttpMethod.Delete, undefined, undefined, ResultType.None);
      setTemplates(templates.filter((t) => !(t.name === templateName && t.resourceType === resourceType)));
    } catch (error) {
      console.error("Failed to delete all template versions", error);
      alert("Failed to delete all template versions. See console for details.");
    }
  };

  // Filter templates based on search & resource type
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.title && template.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      selectedResourceType === "all" || template.resourceType.toLowerCase() === selectedResourceType.toLowerCase();

    return matchesSearch && matchesType;
  });

  // Group templates by name and resource type
  const groupedTemplates = filteredTemplates.reduce(
    (acc, template) => {
      const key = `${template.name}-${template.resourceType}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(template);
      return acc;
    },
    {} as Record<string, Template[]>,
  );

  const totalFamiliesCount = Object.keys(groupedTemplates).length;
  const inUseCount = templates.filter((t) => inUseTemplates.has(getTemplateVersionKey(t.name, t.version))).length;

  return (
    <Stack className="tre-panel tre-resource-panel" tokens={{ childrenGap: 16 }}>
      {/* Header */}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <div>
          <h2
            style={{ margin: 0, fontSize: "22px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Icon iconName="PageList" style={{ color: "#0078d4" }} /> Template Management
          </h2>
        </div>
        <DefaultButton text="Close" onClick={onClose} iconProps={{ iconName: "Cancel" }} />
      </Stack>

      <p style={{ color: "Orange", marginTop: 10 }}>
        Warning: Deleting templates is permanent and cannot be undone. Ensure no resources are using these templates.
      </p>

      {/* KPI Stats Bar */}
      {!loading && templates.length > 0 && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
          <div
            style={{
              background: "#f3f2f1",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 180px",
              borderLeft: "4px solid #0078d4",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c" }}>Registered Template Families</div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "#323130" }}>{totalFamiliesCount}</div>
          </div>
          <div
            style={{
              background: "#f3f2f1",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 180px",
              borderLeft: "4px solid #107c41",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c" }}>Total Registered Versions</div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "#323130" }}>{templates.length}</div>
          </div>
          <div
            style={{
              background: "#f3f2f1",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 180px",
              borderLeft: "4px solid #d97706",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c" }}>Versions In Use</div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "#323130" }}>{inUseCount}</div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      {!loading && templates.length > 0 && (
        <Stack
          horizontal
          horizontalAlign="space-between"
          verticalAlign="center"
          tokens={{ childrenGap: 12 }}
          style={{ flexWrap: "wrap" }}
        >
          <SearchBox
            placeholder="Filter templates by name or description..."
            value={searchQuery}
            onChange={(_, newValue) => setSearchQuery(newValue || "")}
            onClear={() => setSearchQuery("")}
            styles={{ root: { width: 320 } }}
          />

          <Stack horizontal tokens={{ childrenGap: 6 }}>
            {[
              "all",
              ResourceType.Workspace,
              ResourceType.WorkspaceService,
              ResourceType.UserResource,
              ResourceType.SharedService,
            ].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedResourceType(type)}
                style={{
                  border: "none",
                  borderRadius: "16px",
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: selectedResourceType === type ? 600 : 400,
                  backgroundColor: selectedResourceType === type ? "#0078d4" : "#f3f2f1",
                  color: selectedResourceType === type ? "#ffffff" : "#323130",
                  cursor: "pointer",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {type === "all" ? "All Types" : type}
              </button>
            ))}
          </Stack>
        </Stack>
      )}

      {loading && <Spinner label="Loading templates..." />}

      {!loading && templates.length === 0 && <div style={{ marginTop: 20 }}>No templates found.</div>}

      {!loading && templates.length > 0 && filteredTemplates.length === 0 && (
        <div style={{ marginTop: 20, color: "#605e5c", textAlign: "center", padding: "20px" }}>
          No templates match your search filter criteria.
        </div>
      )}

      {!loading && filteredTemplates.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          {Object.entries(groupedTemplates).map(([key, templateVersions]) => {
            const firstTemplate = templateVersions[0];
            const isAnyVersionInUse = templateVersions.some((v) =>
              inUseTemplates.has(getTemplateVersionKey(v.name, v.version)),
            );
            const typeStyle = getResourceTypeColor(firstTemplate.resourceType);

            return (
              <div
                key={key}
                style={{
                  marginBottom: 24,
                  border: "1px solid #e1dfdd",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                }}
              >
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, display: "flex", alignItems: "center", fontSize: "16px", fontWeight: 600 }}>
                      {firstTemplate.title || firstTemplate.name}
                      {isAnyVersionInUse && (
                        <span
                          style={{
                            backgroundColor: "#edebe9",
                            borderRadius: "4px",
                            padding: "3px 8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            marginLeft: "10px",
                          }}
                        >
                          In Use
                        </span>
                      )}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                      <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#605e5c" }}>
                        {firstTemplate.name}
                      </span>
                      <span
                        style={{
                          backgroundColor: typeStyle.bg,
                          color: typeStyle.text,
                          border: `1px solid ${typeStyle.border}30`,
                          borderRadius: "12px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 500,
                        }}
                      >
                        {firstTemplate.resourceType}
                      </span>
                    </div>
                    {firstTemplate.description && (
                      <div style={{ fontSize: "13px", marginTop: 6, color: "#605e5c" }}>
                        {firstTemplate.description}
                      </div>
                    )}
                  </div>
                  <PrimaryButton
                    text={`Delete All ${templateVersions.length} Version(s)`}
                    onClick={() =>
                      handleDeleteAllVersions(firstTemplate.name, firstTemplate.resourceType, templateVersions)
                    }
                    styles={{ root: { backgroundColor: isAnyVersionInUse ? "#b3b3b3" : "#a4262c" } }}
                    disabled={isAnyVersionInUse}
                    data-testid={`delete-all-${firstTemplate.name}`}
                  />
                </Stack>

                <table className="tre-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#faf9f8", borderBottom: "2px solid #edebe9", textAlign: "left" }}>
                      <th style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                        Version
                      </th>
                      <th style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                        Current
                      </th>
                      <th style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>ID</th>
                      <th style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templateVersions
                      .sort((a, b) => semver.rcompare(a.version, b.version))
                      .map((template) => {
                        const usage = inUseTemplates.get(getTemplateVersionKey(template.name, template.version));
                        const isVersionInUse = usage && usage.length > 0;
                        return (
                          <tr key={template.id} style={{ borderBottom: "1px solid #f3f2f1" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <strong>{template.version}</strong>
                              {isVersionInUse && (
                                <TooltipHost
                                  content={
                                    <ul style={{ margin: 0, paddingInlineStart: "20px" }}>
                                      {usage!.map((u: TemplateUsage) => (
                                        <li key={u.id}>
                                          {u.displayName || u.id} ({u.resourceType})
                                        </li>
                                      ))}
                                    </ul>
                                  }
                                  directionalHint={DirectionalHint.rightCenter}
                                >
                                  <span
                                    style={{
                                      backgroundColor: "#edebe9",
                                      borderRadius: "4px",
                                      padding: "2px 6px",
                                      fontSize: "10px",
                                      fontWeight: "600",
                                      marginLeft: "8px",
                                      verticalAlign: "middle",
                                      cursor: "help",
                                    }}
                                  >
                                    In Use
                                  </span>
                                </TooltipHost>
                              )}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {template.current ? (
                                <span style={{ color: "green", fontWeight: "bold" }}>✓ Current</span>
                              ) : (
                                <span style={{ color: "#666" }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: "11px", color: "#666" }}>{template.id}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <DefaultButton
                                text="Delete Version"
                                onClick={() => handleDeleteVersion(template.id, template.name, template.version)}
                                disabled={isVersionInUse}
                                title={isVersionInUse ? "Cannot delete template version in use" : undefined}
                              />
                            </td>
                          </tr>
                        );
                      })}
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
