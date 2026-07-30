import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Stack,
  DefaultButton,
  PrimaryButton,
  SearchBox,
  Dropdown,
  IDropdownOption,
  Icon,
  Spinner,
  MessageBar,
  MessageBarType,
  TooltipHost,
  DirectionalHint,
} from "@fluentui/react";
import { useAuthApiCall, HttpMethod } from "../../../hooks/useAuthApiCall";
import { ApiEndpoint } from "../../../models/apiEndpoints";
import { Resource, AvailableUpgrade } from "../../../models/resource";
import { ResourceType } from "../../../models/resourceType";
import { Workspace } from "../../../models/workspace";
import { SharedService } from "../../../models/sharedService";
import { ConfirmUpgradeResource } from "../ConfirmUpgradeResource";
import { WorkspaceContext } from "../../../contexts/WorkspaceContext";
import TemplateViewerModal from "./TemplateViewerModal";

export interface UpgradableItem {
  resource: Resource;
  parentWorkspace?: {
    id: string;
    name: string;
    scopeId?: string;
  };
  parentService?: {
    id: string;
    name: string;
  };
}

export interface UpgradableResourcesProps {
  onClose: () => void;
}

const getResourceTypeBadge = (type: string) => {
  switch (type.toLowerCase()) {
    case ResourceType.Workspace.toLowerCase():
      return { bg: "#eff6fc", color: "#0078d4", border: "#c7e0f4", label: "Workspace" };
    case ResourceType.WorkspaceService.toLowerCase():
      return { bg: "#f3f2f1", color: "#5c2d91", border: "#d1c4e9", label: "Workspace Service" };
    case ResourceType.UserResource.toLowerCase():
      return { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", label: "User Resource" };
    case ResourceType.SharedService.toLowerCase():
      return { bg: "#fff7ed", color: "#c2410c", border: "#ffedd5", label: "Shared Service" };
    default:
      return { bg: "#f3f2f1", color: "#605e5c", border: "#e1dfdd", label: type };
  }
};

const getDeploymentStatusBadge = (status: string, isEnabled: boolean) => {
  if (!isEnabled) {
    return { bg: "#f3f2f1", color: "#605e5c", label: "Disabled" };
  }
  switch (status?.toLowerCase()) {
    case "deployed":
    case "success":
    case "completed":
      return { bg: "#dff6dd", color: "#107c41", label: "Deployed" };
    case "awaiting_deployment":
    case "deploying":
    case "in_progress":
    case "updating":
    case "upgrading":
      return { bg: "#fff4ce", color: "#797775", label: status };
    case "failed":
      return { bg: "#fde7e9", color: "#a4262c", label: "Failed" };
    case "deleting":
    case "deleted":
      return { bg: "#fff7ed", color: "#c2410c", label: status };
    default:
      return { bg: "#f3f2f1", color: "#605e5c", label: status || "Unknown" };
  }
};

export const UpgradableResources: React.FC<UpgradableResourcesProps> = ({ onClose }) => {
  const [items, setItems] = useState<UpgradableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<"upgradable" | "all">("upgradable");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedImpactFilter, setSelectedImpactFilter] = useState<string>("all");

  // Upgrade Modal state
  const [selectedItemForUpgrade, setSelectedItemForUpgrade] = useState<UpgradableItem | null>(null);

  // Template Viewer Modal state
  const [viewingTemplate, setViewingTemplate] = useState<{
    templateName: string;
    initialVersion: string;
    compareVersion?: string;
    resourceType?: string;
  } | null>(null);

  const apiCall = useAuthApiCall();

  const fetchUpgradableResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    const collectedItems: UpgradableItem[] = [];

    try {
      // 1. Fetch Workspaces & Shared Services concurrently
      const [workspacesRes, sharedServicesRes] = await Promise.allSettled([
        apiCall(ApiEndpoint.Workspaces, HttpMethod.Get),
        apiCall(ApiEndpoint.SharedServices, HttpMethod.Get),
      ]);

      const workspaces: Workspace[] =
        workspacesRes.status === "fulfilled" && workspacesRes.value?.workspaces ? workspacesRes.value.workspaces : [];

      const sharedServices: SharedService[] =
        sharedServicesRes.status === "fulfilled" && sharedServicesRes.value?.sharedServices
          ? sharedServicesRes.value.sharedServices
          : [];

      // Add Workspaces to list
      workspaces.forEach((ws) => {
        collectedItems.push({
          resource: ws as Resource,
        });
      });

      // Add Shared Services to list
      sharedServices.forEach((ss) => {
        collectedItems.push({
          resource: ss as Resource,
        });
      });

      // 2. Fetch Workspace Services & User Resources for each workspace
      await Promise.all(
        workspaces.map(async (ws) => {
          try {
            const scopeId = ws.properties?.scope_id;
            const wsServicesRes = await apiCall(
              `${ApiEndpoint.Workspaces}/${ws.id}/${ApiEndpoint.WorkspaceServices}`,
              HttpMethod.Get,
              scopeId,
            );

            const services = wsServicesRes?.workspaceServices || [];
            services.forEach((wss: any) => {
              collectedItems.push({
                resource: wss as Resource,
                parentWorkspace: {
                  id: ws.id,
                  name: ws.properties?.display_name || ws.id,
                  scopeId: scopeId,
                },
              });
            });

            // Fetch User Resources for each Workspace Service
            await Promise.all(
              services.map(async (wss: any) => {
                try {
                  const userRes = await apiCall(
                    `${ApiEndpoint.Workspaces}/${ws.id}/${ApiEndpoint.WorkspaceServices}/${wss.id}/${ApiEndpoint.UserResources}`,
                    HttpMethod.Get,
                    scopeId,
                  );

                  const userResources = userRes?.userResources || [];
                  userResources.forEach((ur: any) => {
                    collectedItems.push({
                      resource: ur as Resource,
                      parentWorkspace: {
                        id: ws.id,
                        name: ws.properties?.display_name || ws.id,
                        scopeId: scopeId,
                      },
                      parentService: {
                        id: wss.id,
                        name: wss.properties?.display_name || wss.id,
                      },
                    });
                  });
                } catch (err) {
                  console.warn(`Failed to fetch user resources for workspace service ${wss.id}`, err);
                }
              }),
            );
          } catch (err) {
            console.warn(`Failed to fetch workspace services for workspace ${ws.id}`, err);
          }
        }),
      );

      setItems(collectedItems);
    } catch (err: any) {
      console.error("Failed to load upgradable components", err);
      setError("Failed to retrieve system workspaces and components for upgrade analysis.");
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    fetchUpgradableResources();
  }, [fetchUpgradableResources]);

  // Derived Statistics
  const stats = useMemo(() => {
    const upgradableItems = items.filter(
      (item) => item.resource.availableUpgrades && item.resource.availableUpgrades.length > 0,
    );

    const workspaces = upgradableItems.filter(
      (item) => item.resource.resourceType?.toLowerCase() === ResourceType.Workspace.toLowerCase(),
    ).length;

    const workspaceServices = upgradableItems.filter(
      (item) => item.resource.resourceType?.toLowerCase() === ResourceType.WorkspaceService.toLowerCase(),
    ).length;

    const userResources = upgradableItems.filter(
      (item) => item.resource.resourceType?.toLowerCase() === ResourceType.UserResource.toLowerCase(),
    ).length;

    const sharedServices = upgradableItems.filter(
      (item) => item.resource.resourceType?.toLowerCase() === ResourceType.SharedService.toLowerCase(),
    ).length;

    return {
      totalUpgradable: upgradableItems.length,
      totalComponents: items.length,
      workspaces,
      workspaceServices,
      userResources,
      sharedServices,
    };
  }, [items]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const upgrades = item.resource.availableUpgrades || [];
      const hasUpgrades = upgrades.length > 0;

      // View Filter (Upgradable Only vs All)
      if (viewFilter === "upgradable" && !hasUpgrades) {
        return false;
      }

      // Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const displayName = (item.resource.properties?.display_name || "").toLowerCase();
        const resId = (item.resource.id || "").toLowerCase();
        const templateName = (item.resource.templateName || "").toLowerCase();
        const parentWsName = (item.parentWorkspace?.name || "").toLowerCase();
        const parentSvcName = (item.parentService?.name || "").toLowerCase();

        const matches =
          displayName.includes(query) ||
          resId.includes(query) ||
          templateName.includes(query) ||
          parentWsName.includes(query) ||
          parentSvcName.includes(query);

        if (!matches) return false;
      }

      // Resource Type Filter
      if (selectedTypeFilter !== "all") {
        if (item.resource.resourceType?.toLowerCase() !== selectedTypeFilter.toLowerCase()) {
          return false;
        }
      }

      // Upgrade Impact Filter
      if (selectedImpactFilter !== "all") {
        if (selectedImpactFilter === "minor") {
          // Has non-major upgrades available
          const hasNonMajor = upgrades.some((u) => !u.forceUpdateRequired);
          if (!hasNonMajor) return false;
        } else if (selectedImpactFilter === "major") {
          // Has major upgrade requiring force update
          const hasMajor = upgrades.some((u) => u.forceUpdateRequired);
          if (!hasMajor) return false;
        }
      }

      return true;
    });
  }, [items, viewFilter, searchQuery, selectedTypeFilter, selectedImpactFilter]);

  const typeOptions: IDropdownOption[] = [
    { key: "all", text: "All Resource Types" },
    { key: ResourceType.Workspace, text: "Workspaces" },
    { key: ResourceType.WorkspaceService, text: "Workspace Services" },
    { key: ResourceType.UserResource, text: "User Resources" },
    { key: ResourceType.SharedService, text: "Shared Services" },
  ];

  const impactOptions: IDropdownOption[] = [
    { key: "all", text: "All Upgrade Types" },
    { key: "minor", text: "Minor / Patch Upgrades Available" },
    { key: "major", text: "Major Upgrade Required" },
  ];

  return (
    <Stack className="tre-panel tre-resource-panel" tokens={{ childrenGap: 16 }}>
      {/* Header */}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#0078d4",
            }}
          >
            <Icon iconName="ProductUpgrade" style={{ fontSize: "24px", color: "#0078d4" }} /> Upgradable Components &
            Workspaces
          </h2>
          <div style={{ color: "#605e5c", fontSize: "13px", marginTop: "4px" }}>
            Single view to inspect, monitor, and upgrade all workspaces, shared services, workspace services, and user
            resources with available template updates.
          </div>
        </div>
        <DefaultButton text="Close" onClick={onClose} iconProps={{ iconName: "Cancel" }} />
      </Stack>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}

      {/* KPI Stats Bar */}
      {!loading && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div
            style={{
              background: "#f3f9ff",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 170px",
              borderLeft: "4px solid #0078d4",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon iconName="ProductUpgrade" style={{ color: "#0078d4", fontSize: "14px" }} />
              <span>Upgradable Components</span>
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "#0078d4", marginTop: "4px" }}>
              {stats.totalUpgradable}{" "}
              <span style={{ fontSize: "12px", fontWeight: 400, color: "#605e5c" }}>/ {stats.totalComponents}</span>
            </div>
          </div>

          <div
            style={{
              background: "#f3f2f1",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 140px",
              borderLeft: "4px solid #0078d4",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon iconName="Folder" style={{ color: "#0078d4", fontSize: "14px" }} />
              <span>Workspaces</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#323130", marginTop: "4px" }}>
              {stats.workspaces}
            </div>
          </div>

          <div
            style={{
              background: "#f3f2f1",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 140px",
              borderLeft: "4px solid #5c2d91",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon iconName="Services" style={{ color: "#5c2d91", fontSize: "14px" }} />
              <span>Workspace Services</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#323130", marginTop: "4px" }}>
              {stats.workspaceServices}
            </div>
          </div>

          <div
            style={{
              background: "#f3f2f1",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 140px",
              borderLeft: "4px solid #166534",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon iconName="System" style={{ color: "#166534", fontSize: "14px" }} />
              <span>User Resources</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#323130", marginTop: "4px" }}>
              {stats.userResources}
            </div>
          </div>

          <div
            style={{
              background: "#f3f2f1",
              padding: "10px 16px",
              borderRadius: "6px",
              flex: "1 1 140px",
              borderLeft: "4px solid #c2410c",
            }}
          >
            <div style={{ fontSize: "12px", color: "#605e5c", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon iconName="SharedDatabase" style={{ color: "#c2410c", fontSize: "14px" }} />
              <span>Shared Services</span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#323130", marginTop: "4px" }}>
              {stats.sharedServices}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar & Filters */}
      <Stack
        horizontal
        horizontalAlign="space-between"
        verticalAlign="center"
        tokens={{ childrenGap: 12 }}
        style={{ flexWrap: "wrap" }}
      >
        <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center" style={{ flexWrap: "wrap" }}>
          <SearchBox
            placeholder="Search component, template, workspace..."
            value={searchQuery}
            onChange={(e, newValue) => setSearchQuery(newValue ?? (e?.target as HTMLInputElement)?.value ?? "")}
            onClear={() => setSearchQuery("")}
            styles={{ root: { width: 300 } }}
          />

          <Dropdown
            selectedKey={selectedTypeFilter}
            onChange={(_, opt) => setSelectedTypeFilter((opt?.key as string) || "all")}
            options={typeOptions}
            styles={{ root: { width: 180 } }}
          />

          <Dropdown
            selectedKey={selectedImpactFilter}
            onChange={(_, opt) => setSelectedImpactFilter((opt?.key as string) || "all")}
            options={impactOptions}
            styles={{ root: { width: 210 } }}
          />
        </Stack>

        <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
          <div style={{ display: "flex", background: "#f3f2f1", padding: "2px", borderRadius: "4px" }}>
            <button
              onClick={() => setViewFilter("upgradable")}
              style={{
                border: "none",
                background: viewFilter === "upgradable" ? "#0078d4" : "transparent",
                color: viewFilter === "upgradable" ? "#ffffff" : "#323130",
                padding: "5px 12px",
                borderRadius: "3px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Upgradable Only ({stats.totalUpgradable})
            </button>
            <button
              onClick={() => setViewFilter("all")}
              style={{
                border: "none",
                background: viewFilter === "all" ? "#0078d4" : "transparent",
                color: viewFilter === "all" ? "#ffffff" : "#323130",
                padding: "5px 12px",
                borderRadius: "3px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              All Components ({stats.totalComponents})
            </button>
          </div>

          <DefaultButton
            iconProps={{ iconName: "Refresh" }}
            text="Refresh"
            onClick={fetchUpgradableResources}
            disabled={loading}
          />
        </Stack>
      </Stack>

      {/* Main Table / State view */}
      {loading && <Spinner label="Analyzing component template versions..." />}

      {!loading && filteredItems.length === 0 && (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#605e5c",
            background: "#faf9f8",
            borderRadius: "6px",
            border: "1px dashed #c8c6c4",
            marginTop: "10px",
          }}
        >
          <Icon iconName="CheckMark" style={{ fontSize: "28px", color: "#107c41", marginBottom: "8px" }} />
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#323130" }}>
            {viewFilter === "upgradable"
              ? "All workspace components are up to date!"
              : "No components match your search filter criteria."}
          </div>
          <div style={{ fontSize: "13px", marginTop: "4px" }}>
            {viewFilter === "upgradable"
              ? "No pending template version upgrades detected across workspaces or services."
              : "Try adjusting your search terms or filter dropdown selections."}
          </div>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="tre-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#faf9f8", borderBottom: "2px solid #edebe9", textAlign: "left" }}>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                  Component / Resource
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Type</th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                  Parent Context
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                  Current Version
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                  Available Upgrades
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Status</th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const res = item.resource;
                const typeBadge = getResourceTypeBadge(res.resourceType || "");
                const statusBadge = getDeploymentStatusBadge(res.deploymentStatus, res.isEnabled);
                const upgrades = res.availableUpgrades || [];
                const hasUpgrades = upgrades.length > 0;
                const nonMajorUpgrades = upgrades.filter((u) => !u.forceUpdateRequired);

                const displayName = res.properties?.display_name || res.id;

                return (
                  <tr
                    key={res.id}
                    style={{
                      borderBottom: "1px solid #f3f2f1",
                      backgroundColor: hasUpgrades ? "#ffffff" : "#faf9f8",
                    }}
                  >
                    {/* Component / Resource Name & ID */}
                    <td style={{ padding: "10px 12px" }}>
                      <Link
                        to={res.resourcePath}
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          color: "#0078d4",
                          textDecoration: "none",
                        }}
                      >
                        {displayName}
                      </Link>
                      <div style={{ fontSize: "11px", color: "#605e5c", fontFamily: "monospace", marginTop: "2px" }}>
                        {res.id}
                      </div>
                    </td>

                    {/* Resource Type */}
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          backgroundColor: typeBadge.bg,
                          color: typeBadge.color,
                          border: `1px solid ${typeBadge.border}`,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 600,
                          display: "inline-block",
                        }}
                      >
                        {typeBadge.label}
                      </span>
                    </td>

                    {/* Parent Context */}
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#323130" }}>
                      {item.parentWorkspace ? (
                        <div>
                          <div>
                            <span style={{ color: "#605e5c", fontSize: "11px" }}>WS: </span>
                            <Link
                              to={`/workspaces/${item.parentWorkspace.id}`}
                              style={{ color: "#0078d4", textDecoration: "none", fontWeight: 500 }}
                            >
                              {item.parentWorkspace.name}
                            </Link>
                          </div>
                          {item.parentService && (
                            <div style={{ fontSize: "11px", marginTop: "2px" }}>
                              <span style={{ color: "#605e5c" }}>SVC: </span>
                              <Link
                                to={`/workspaces/${item.parentWorkspace.id}/workspace-services/${item.parentService.id}`}
                                style={{ color: "#0078d4", textDecoration: "none", fontWeight: 500 }}
                              >
                                {item.parentService.name}
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : res.resourceType === ResourceType.Workspace ? (
                        <Link
                          to={res.resourcePath}
                          style={{ color: "#0078d4", fontWeight: 500, textDecoration: "none" }}
                        >
                          Root Workspace
                        </Link>
                      ) : (
                        <Link
                          to={res.resourcePath}
                          style={{ color: "#c2410c", fontWeight: 500, textDecoration: "none" }}
                        >
                          Global Shared Service
                        </Link>
                      )}
                    </td>

                    {/* Current Version */}
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, fontSize: "12px", color: "#323130" }}>{res.templateName}</div>
                      <button
                        onClick={() =>
                          setViewingTemplate({
                            templateName: res.templateName,
                            initialVersion: res.templateVersion,
                            compareVersion: upgrades[0]?.version,
                            resourceType: res.resourceType,
                          })
                        }
                        style={{
                          background: "#eff6fc",
                          border: "1px solid #c7e0f4",
                          borderRadius: "10px",
                          color: "#0078d4",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "2px",
                        }}
                        title="Click to view template JSON definition & diff versions"
                      >
                        <Icon iconName="Code" style={{ fontSize: "10px" }} />v{res.templateVersion}
                      </button>
                    </td>

                    {/* Available Upgrades */}
                    <td style={{ padding: "10px 12px" }}>
                      {hasUpgrades ? (
                        <Stack horizontal tokens={{ childrenGap: 4 }} style={{ flexWrap: "wrap" }}>
                          {upgrades.map((upg: AvailableUpgrade) => (
                            <TooltipHost
                              key={upg.version}
                              content={
                                upg.forceUpdateRequired
                                  ? "Major version upgrade - click to view JSON diff"
                                  : "Minor/Patch template update - click to view JSON diff"
                              }
                              directionalHint={DirectionalHint.topCenter}
                            >
                              <button
                                onClick={() =>
                                  setViewingTemplate({
                                    templateName: res.templateName,
                                    initialVersion: res.templateVersion,
                                    compareVersion: upg.version,
                                    resourceType: res.resourceType,
                                  })
                                }
                                style={{
                                  backgroundColor: upg.forceUpdateRequired ? "#fff4ce" : "#dff6dd",
                                  color: upg.forceUpdateRequired ? "#797775" : "#107c41",
                                  border: upg.forceUpdateRequired ? "1px solid #fce100" : "1px solid #92c894",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  cursor: "pointer",
                                }}
                                title="Click to view template JSON & compare with this upgrade version"
                              >
                                {upg.forceUpdateRequired && <Icon iconName="Warning" style={{ fontSize: "10px" }} />}
                                <Icon iconName="Code" style={{ fontSize: "10px" }} />v{upg.version}
                              </button>
                            </TooltipHost>
                          ))}
                        </Stack>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#107c41", fontWeight: 500 }}>✓ Up to date</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          backgroundColor: statusBadge.bg,
                          color: statusBadge.color,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          display: "inline-block",
                        }}
                      >
                        {statusBadge.label}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: "10px 12px" }}>
                      <PrimaryButton
                        text="Upgrade"
                        iconProps={{ iconName: "Upload" }}
                        disabled={!hasUpgrades || nonMajorUpgrades.length === 0 || !res.isEnabled}
                        title={
                          !res.isEnabled
                            ? "Resource must be enabled before upgrading"
                            : !hasUpgrades || nonMajorUpgrades.length === 0
                              ? "No non-major upgrades currently available for direct upgrade"
                              : "Upgrade template version"
                        }
                        onClick={() => setSelectedItemForUpgrade(item)}
                        styles={{ root: { height: "30px" } }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Template Viewer & Diff Modal */}
      {viewingTemplate && (
        <TemplateViewerModal
          templateName={viewingTemplate.templateName}
          initialVersion={viewingTemplate.initialVersion}
          compareVersion={viewingTemplate.compareVersion}
          resourceType={viewingTemplate.resourceType}
          onClose={() => setViewingTemplate(null)}
        />
      )}

      {/* Upgrade Dialog */}
      {selectedItemForUpgrade && (
        <WorkspaceContext.Provider
          value={{
            workspaceApplicationIdURI: selectedItemForUpgrade.parentWorkspace?.scopeId || "",
            roles: [],
            setRoles: () => {},
            costs: [],
            setCosts: () => {},
            workspace: {} as any,
            setWorkspace: () => {},
          }}
        >
          <ConfirmUpgradeResource
            resource={selectedItemForUpgrade.resource}
            onDismiss={() => {
              setSelectedItemForUpgrade(null);
              fetchUpgradableResources();
            }}
          />
        </WorkspaceContext.Provider>
      )}
    </Stack>
  );
};

export default UpgradableResources;
