import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Stack,
  DefaultButton,
  PrimaryButton,
  SearchBox,
  Dropdown,
  IDropdownOption,
  Icon,
  Spinner,
  Dialog,
  DialogFooter,
  Persona,
  PersonaSize,
  Checkbox,
  MessageBar,
  MessageBarType,
} from "@fluentui/react";
import { useAuthApiCall, HttpMethod } from "../../../hooks/useAuthApiCall";
import { ApiEndpoint } from "../../../models/apiEndpoints";
import { Workspace } from "../../../models/workspace";
import { WorkspaceRoleName } from "../../../models/roleNames";

export interface UserAccessManagementProps {
  onClose: () => void;
}

export interface WorkspaceUserAssignment {
  id: string; // unique key: workspaceId__userId__roleId
  userId: string;
  userDisplayName: string;
  userPrincipalName: string;
  workspaceId: string;
  workspaceName: string;
  roleId: string;
  roleDisplayName: string;
}

export interface AssignableUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

const getRoleBadgeStyle = (roleId: string) => {
  switch (roleId) {
    case WorkspaceRoleName.WorkspaceOwner:
    case "WorkspaceOwner":
      return { bg: "#e1dfdd", color: "#005a9e", border: "#a19f9d", label: "Workspace Owner" };
    case WorkspaceRoleName.WorkspaceResearcher:
    case "WorkspaceResearcher":
      return { bg: "#dff6dd", color: "#107c41", border: "#92c894", label: "Workspace Researcher" };
    case WorkspaceRoleName.AirlockManager:
    case "AirlockManager":
      return { bg: "#fff4ce", color: "#797775", border: "#fce100", label: "Airlock Manager" };
    default:
      return { bg: "#f3f2f1", color: "#323130", border: "#c8c6c4", label: roleId };
  }
};

const UserAccessManagement: React.FC<UserAccessManagementProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<"matrix" | "explorer">("matrix");

  // Workspaces & Matrix state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [assignments, setAssignments] = useState<WorkspaceUserAssignment[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  // Filtering for Matrix
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState<string>("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  // Matrix Row Selection
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());

  // Assignable Users Explorer state
  const [explorerWorkspaceId, setExplorerWorkspaceId] = useState<string>("");
  const [explorerSearchQuery, setExplorerSearchQuery] = useState("");
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);

  // Dialog / Modal States
  const [showBulkRevokeDialog, setShowBulkRevokeDialog] = useState(false);
  const [showBulkReassignDialog, setShowBulkReassignDialog] = useState(false);
  const [targetBulkRole, setTargetBulkRole] = useState<string>("");

  const [singleRevokeAssignment, setSingleRevokeAssignment] = useState<WorkspaceUserAssignment | null>(null);
  const [singleReassignAssignment, setSingleReassignAssignment] = useState<WorkspaceUserAssignment | null>(null);
  const [targetSingleRole, setTargetSingleRole] = useState<string>("");

  const [assignUserModalUser, setAssignUserModalUser] = useState<AssignableUser | null>(null);
  const [targetAssignWorkspaceId, setTargetAssignWorkspaceId] = useState<string>("");
  const [targetAssignRoleId, setTargetAssignRoleId] = useState<string>("");

  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: MessageBarType; text: string } | null>(null);

  const apiCall = useAuthApiCall();

  // Load all workspaces and build user role matrix
  const fetchMatrixData = useCallback(async () => {
    setLoadingMatrix(true);
    setMatrixError(null);
    try {
      const res = await apiCall(ApiEndpoint.Workspaces, HttpMethod.Get);
      const wsList: Workspace[] = res.workspaces || [];
      setWorkspaces(wsList);

      if (wsList.length > 0 && !explorerWorkspaceId) {
        setExplorerWorkspaceId(wsList[0].id);
      }

      // Fetch users for all workspaces in parallel
      const allAssignments: WorkspaceUserAssignment[] = [];
      await Promise.all(
        wsList.map(async (ws) => {
          try {
            const userRes = await apiCall(`${ApiEndpoint.Workspaces}/${ws.id}/${ApiEndpoint.Users}`, HttpMethod.Get);
            if (userRes && userRes.users) {
              userRes.users.forEach((user: any) => {
                const roles = user.roles || [];
                roles.forEach((r: any) => {
                  allAssignments.push({
                    id: `${ws.id}__${user.id}__${r.id}`,
                    userId: user.id,
                    userDisplayName: user.displayName || user.id,
                    userPrincipalName: user.userPrincipalName || "",
                    workspaceId: ws.id,
                    workspaceName: ws.properties?.display_name || ws.id,
                    roleId: r.id,
                    roleDisplayName: r.displayName || r.id,
                  });
                });
              });
            }
          } catch (err) {
            console.warn(`Failed to fetch users for workspace ${ws.id}`, err);
          }
        }),
      );

      setAssignments(allAssignments);
    } catch (err: any) {
      console.error("Failed to load workspace RBAC matrix", err);
      setMatrixError("Failed to retrieve cross-workspace user & role matrix.");
    } finally {
      setLoadingMatrix(false);
    }
  }, [apiCall, explorerWorkspaceId]);

  useEffect(() => {
    fetchMatrixData();
  }, [fetchMatrixData]);

  // Fetch assignable users for selected workspace in Explorer tab
  const fetchAssignableUsers = useCallback(async () => {
    if (!explorerWorkspaceId) return;
    setLoadingExplorer(true);
    setExplorerError(null);
    try {
      const queryParam = explorerSearchQuery ? `?filter=${encodeURIComponent(explorerSearchQuery)}` : "";
      const res = await apiCall(
        `${ApiEndpoint.Workspaces}/${explorerWorkspaceId}/${ApiEndpoint.AssignableUsers}${queryParam}`,
        HttpMethod.Get,
      );
      setAssignableUsers(res.assignable_users || []);
    } catch (err: any) {
      console.error("Failed to fetch assignable users", err);
      if (err && err.status === 404) {
        setExplorerError(
          "Assignable users endpoint returned 404. User management is currently disabled in system configuration (USER_MANAGEMENT_ENABLED=false).",
        );
      } else {
        setExplorerError("Failed to fetch assignable Azure AD users for workspace.");
      }
      setAssignableUsers([]);
    } finally {
      setLoadingExplorer(false);
    }
  }, [apiCall, explorerWorkspaceId, explorerSearchQuery]);

  useEffect(() => {
    if (activeTab === "explorer" && explorerWorkspaceId) {
      fetchAssignableUsers();
    }
  }, [activeTab, explorerWorkspaceId, fetchAssignableUsers]);

  // Filtered Matrix Assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.userDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.userPrincipalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.workspaceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.workspaceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.roleDisplayName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesWorkspace = selectedWorkspaceFilter === "all" || item.workspaceId === selectedWorkspaceFilter;

      const matchesRole = selectedRoleFilter === "all" || item.roleId === selectedRoleFilter;

      return matchesSearch && matchesWorkspace && matchesRole;
    });
  }, [assignments, searchQuery, selectedWorkspaceFilter, selectedRoleFilter]);

  // Matrix Checkbox Handlers
  const handleSelectAll = (checked?: boolean) => {
    if (checked) {
      const allIds = new Set(filteredAssignments.map((a) => a.id));
      setSelectedAssignmentIds(allIds);
    } else {
      setSelectedAssignmentIds(new Set());
    }
  };

  const handleToggleSelectRow = (id: string, checked?: boolean) => {
    const next = new Set(selectedAssignmentIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedAssignmentIds(next);
  };

  const isAllSelected =
    filteredAssignments.length > 0 && filteredAssignments.every((a) => selectedAssignmentIds.has(a.id));

  // Bulk Revoke Action
  const handleExecuteBulkRevoke = async () => {
    setActionInProgress(true);
    let successCount = 0;
    let failCount = 0;

    const selectedItems = assignments.filter((a) => selectedAssignmentIds.has(a.id));

    for (const item of selectedItems) {
      try {
        await apiCall(
          `${ApiEndpoint.Workspaces}/${item.workspaceId}/${ApiEndpoint.Users}/assign?user_id=${item.userId}&role_id=${item.roleId}`,
          HttpMethod.Delete,
        );
        successCount++;
      } catch (err) {
        console.error(`Failed to revoke ${item.userDisplayName} from ${item.workspaceName}`, err);
        failCount++;
      }
    }

    setActionInProgress(false);
    setShowBulkRevokeDialog(false);
    setSelectedAssignmentIds(new Set());

    if (failCount === 0) {
      setActionMessage({
        type: MessageBarType.success,
        text: `Successfully revoked ${successCount} user role assignment(s).`,
      });
    } else {
      setActionMessage({
        type: MessageBarType.warning,
        text: `Revoked ${successCount} assignment(s); ${failCount} failed.`,
      });
    }

    fetchMatrixData();
  };

  // Bulk Reassign Action
  const handleExecuteBulkReassign = async () => {
    if (!targetBulkRole) return;
    setActionInProgress(true);
    let successCount = 0;
    let failCount = 0;

    const selectedItems = assignments.filter((a) => selectedAssignmentIds.has(a.id));

    for (const item of selectedItems) {
      try {
        // If target role is different, remove old assignment & add new assignment
        if (item.roleId !== targetBulkRole) {
          await apiCall(
            `${ApiEndpoint.Workspaces}/${item.workspaceId}/${ApiEndpoint.Users}/assign?user_id=${item.userId}&role_id=${item.roleId}`,
            HttpMethod.Delete,
          );
          await apiCall(
            `${ApiEndpoint.Workspaces}/${item.workspaceId}/${ApiEndpoint.Users}/assign`,
            HttpMethod.Post,
            "",
            { role_id: targetBulkRole, user_ids: [item.userId] },
          );
        }
        successCount++;
      } catch (err) {
        console.error(`Failed to reassign ${item.userDisplayName} in ${item.workspaceName}`, err);
        failCount++;
      }
    }

    setActionInProgress(false);
    setShowBulkReassignDialog(false);
    setSelectedAssignmentIds(new Set());
    setTargetBulkRole("");

    if (failCount === 0) {
      setActionMessage({
        type: MessageBarType.success,
        text: `Successfully reassigned ${successCount} user role assignment(s) to ${targetBulkRole}.`,
      });
    } else {
      setActionMessage({
        type: MessageBarType.warning,
        text: `Reassigned ${successCount} assignment(s); ${failCount} failed.`,
      });
    }

    fetchMatrixData();
  };

  // Single Revoke Action
  const handleExecuteSingleRevoke = async () => {
    if (!singleRevokeAssignment) return;
    setActionInProgress(true);
    try {
      await apiCall(
        `${ApiEndpoint.Workspaces}/${singleRevokeAssignment.workspaceId}/${ApiEndpoint.Users}/assign?user_id=${singleRevokeAssignment.userId}&role_id=${singleRevokeAssignment.roleId}`,
        HttpMethod.Delete,
      );
      setActionMessage({
        type: MessageBarType.success,
        text: `Revoked ${singleRevokeAssignment.userDisplayName} from ${singleRevokeAssignment.roleDisplayName} in ${singleRevokeAssignment.workspaceName}.`,
      });
    } catch (err) {
      console.error("Single revoke failed", err);
      setActionMessage({
        type: MessageBarType.error,
        text: `Failed to revoke role assignment for ${singleRevokeAssignment.userDisplayName}.`,
      });
    } finally {
      setActionInProgress(false);
      setSingleRevokeAssignment(null);
      fetchMatrixData();
    }
  };

  // Single Reassign Action
  const handleExecuteSingleReassign = async () => {
    if (!singleReassignAssignment || !targetSingleRole) return;
    setActionInProgress(true);
    try {
      if (singleReassignAssignment.roleId !== targetSingleRole) {
        await apiCall(
          `${ApiEndpoint.Workspaces}/${singleReassignAssignment.workspaceId}/${ApiEndpoint.Users}/assign?user_id=${singleReassignAssignment.userId}&role_id=${singleReassignAssignment.roleId}`,
          HttpMethod.Delete,
        );
        await apiCall(
          `${ApiEndpoint.Workspaces}/${singleReassignAssignment.workspaceId}/${ApiEndpoint.Users}/assign`,
          HttpMethod.Post,
          "",
          { role_id: targetSingleRole, user_ids: [singleReassignAssignment.userId] },
        );
      }
      setActionMessage({
        type: MessageBarType.success,
        text: `Reassigned ${singleReassignAssignment.userDisplayName} to ${targetSingleRole} in ${singleReassignAssignment.workspaceName}.`,
      });
    } catch (err) {
      console.error("Single reassign failed", err);
      setActionMessage({
        type: MessageBarType.error,
        text: `Failed to reassign role for ${singleReassignAssignment.userDisplayName}.`,
      });
    } finally {
      setActionInProgress(false);
      setSingleReassignAssignment(null);
      setTargetSingleRole("");
      fetchMatrixData();
    }
  };

  // Assign User to Workspace (from Explorer)
  const handleExecuteAssignUser = async () => {
    if (!assignUserModalUser || !targetAssignWorkspaceId || !targetAssignRoleId) return;
    setActionInProgress(true);
    try {
      await apiCall(
        `${ApiEndpoint.Workspaces}/${targetAssignWorkspaceId}/${ApiEndpoint.Users}/assign`,
        HttpMethod.Post,
        "",
        { role_id: targetAssignRoleId, user_ids: [assignUserModalUser.id] },
      );
      setActionMessage({
        type: MessageBarType.success,
        text: `Successfully assigned ${assignUserModalUser.displayName} as ${targetAssignRoleId}.`,
      });
    } catch (err) {
      console.error("Assign user failed", err);
      setActionMessage({
        type: MessageBarType.error,
        text: `Failed to assign ${assignUserModalUser.displayName} to workspace role.`,
      });
    } finally {
      setActionInProgress(false);
      setAssignUserModalUser(null);
      setTargetAssignWorkspaceId("");
      setTargetAssignRoleId("");
      fetchMatrixData();
    }
  };

  // Workspace Dropdown Options
  const workspaceOptions: IDropdownOption[] = useMemo(() => {
    const opts: IDropdownOption[] = [{ key: "all", text: "All Workspaces" }];
    workspaces.forEach((ws) => {
      opts.push({ key: ws.id, text: ws.properties?.display_name || ws.id });
    });
    return opts;
  }, [workspaces]);

  const explorerWorkspaceOptions: IDropdownOption[] = useMemo(() => {
    return workspaces.map((ws) => ({
      key: ws.id,
      text: ws.properties?.display_name || ws.id,
    }));
  }, [workspaces]);

  const roleOptions: IDropdownOption[] = [
    { key: "WorkspaceOwner", text: "Workspace Owner (WorkspaceOwner)" },
    { key: "WorkspaceResearcher", text: "Workspace Researcher (WorkspaceResearcher)" },
    { key: "AirlockManager", text: "Airlock Manager (AirlockManager)" },
  ];

  return (
    <Stack className="tre-panel tre-resource-panel" tokens={{ childrenGap: 16 }}>
      {/* Top Header */}
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
            <Icon iconName="People" style={{ fontSize: "22px", color: "#0078d4" }} /> Global User & Access Management
            (RBAC Audit)
          </h2>
          <div style={{ color: "#605e5c", fontSize: "13px", marginTop: "4px" }}>
            Audit cross-workspace role assignments, execute bulk role reassignments or revocations, and explore
            assignable Azure AD users.
          </div>
        </div>
        <DefaultButton text="Close" onClick={onClose} iconProps={{ iconName: "Cancel" }} />
      </Stack>

      {actionMessage && (
        <MessageBar
          messageBarType={actionMessage.type}
          onDismiss={() => setActionMessage(null)}
          dismissButtonAriaLabel="Close"
        >
          {actionMessage.text}
        </MessageBar>
      )}

      {/* Tabs */}
      <Stack horizontal tokens={{ childrenGap: 8 }} style={{ borderBottom: "1px solid #e1dfdd", paddingBottom: "8px" }}>
        <button
          onClick={() => setActiveTab("matrix")}
          style={{
            border: "none",
            background: activeTab === "matrix" ? "#0078d4" : "transparent",
            color: activeTab === "matrix" ? "#ffffff" : "#323130",
            padding: "8px 16px",
            borderRadius: "4px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Icon iconName="Table" /> Cross-Workspace User & Role Matrix
        </button>
        <button
          onClick={() => setActiveTab("explorer")}
          style={{
            border: "none",
            background: activeTab === "explorer" ? "#0078d4" : "transparent",
            color: activeTab === "explorer" ? "#ffffff" : "#323130",
            padding: "8px 16px",
            borderRadius: "4px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Icon iconName="UserOptional" /> Assignable Users Explorer
        </button>
      </Stack>

      {/* TAB 1: CROSS-WORKSPACE USER & ROLE MATRIX */}
      {activeTab === "matrix" && (
        <Stack tokens={{ childrenGap: 14 }}>
          {/* Controls Bar */}
          <Stack
            horizontal
            horizontalAlign="space-between"
            verticalAlign="center"
            tokens={{ childrenGap: 12 }}
            style={{ flexWrap: "wrap" }}
          >
            <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center" style={{ flexWrap: "wrap" }}>
              <SearchBox
                placeholder="Search user, UPN, workspace, or role..."
                value={searchQuery}
                onChange={(_, val) => setSearchQuery(val || "")}
                onClear={() => setSearchQuery("")}
                styles={{ root: { width: 260 } }}
              />

              <Dropdown
                selectedKey={selectedWorkspaceFilter}
                onChange={(_, opt) => setSelectedWorkspaceFilter((opt?.key as string) || "all")}
                options={workspaceOptions}
                styles={{ root: { width: 180 } }}
              />

              <Dropdown
                selectedKey={selectedRoleFilter}
                onChange={(_, opt) => setSelectedRoleFilter((opt?.key as string) || "all")}
                options={[
                  { key: "all", text: "All Roles" },
                  { key: "WorkspaceOwner", text: "Workspace Owner" },
                  { key: "WorkspaceResearcher", text: "Workspace Researcher" },
                  { key: "AirlockManager", text: "Airlock Manager" },
                ]}
                styles={{ root: { width: 170 } }}
              />
            </Stack>

            {/* Bulk Actions */}
            <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
              {selectedAssignmentIds.size > 0 && (
                <span style={{ fontSize: "12px", color: "#0078d4", fontWeight: 600, marginRight: "4px" }}>
                  {selectedAssignmentIds.size} selected
                </span>
              )}
              <DefaultButton
                text="Bulk Reassign Role"
                iconProps={{ iconName: "UserSync" }}
                disabled={selectedAssignmentIds.size === 0}
                onClick={() => setShowBulkReassignDialog(true)}
              />
              <DefaultButton
                text="Bulk Revoke Access"
                iconProps={{ iconName: "UserRemove" }}
                disabled={selectedAssignmentIds.size === 0}
                onClick={() => setShowBulkRevokeDialog(true)}
                styles={{
                  root: selectedAssignmentIds.size > 0 ? { borderColor: "#a4262c", color: "#a4262c" } : {},
                }}
              />
            </Stack>
          </Stack>

          {loadingMatrix && <Spinner label="Loading cross-workspace role assignments..." />}

          {matrixError && (
            <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setMatrixError(null)}>
              {matrixError}
            </MessageBar>
          )}

          {!loadingMatrix && !matrixError && filteredAssignments.length === 0 && (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "#605e5c",
                background: "#faf9f8",
                borderRadius: "6px",
                border: "1px dashed #c8c6c4",
              }}
            >
              No user role assignments match your selected search query or filters.
            </div>
          )}

          {!loadingMatrix && !matrixError && filteredAssignments.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="tre-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#faf9f8", borderBottom: "2px solid #edebe9", textAlign: "left" }}>
                    <th style={{ padding: "10px", width: "40px" }}>
                      <Checkbox checked={isAllSelected} onChange={(_, checked) => handleSelectAll(checked)} />
                    </th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>User</th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Workspace
                    </th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Assigned Role
                    </th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((item) => {
                    const badge = getRoleBadgeStyle(item.roleId);
                    const isChecked = selectedAssignmentIds.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid #f3f2f1",
                          backgroundColor: isChecked ? "#f0f6ff" : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px" }}>
                          <Checkbox
                            checked={isChecked}
                            onChange={(_, checked) => handleToggleSelectRow(item.id, checked)}
                          />
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <Persona
                            text={item.userDisplayName}
                            secondaryText={item.userPrincipalName}
                            size={PersonaSize.size32}
                          />
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, fontSize: "13px" }}>{item.workspaceName}</div>
                          <div style={{ fontSize: "11px", color: "#605e5c", fontFamily: "monospace" }}>
                            {item.workspaceId}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                              padding: "3px 10px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 600,
                              display: "inline-block",
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <Stack horizontal tokens={{ childrenGap: 6 }}>
                            <DefaultButton
                              text="Reassign"
                              iconProps={{ iconName: "UserSync" }}
                              onClick={() => {
                                setSingleReassignAssignment(item);
                                setTargetSingleRole(item.roleId);
                              }}
                              styles={{ root: { padding: "4px 8px", height: "28px" } }}
                            />
                            <DefaultButton
                              text="Revoke"
                              iconProps={{ iconName: "UserRemove" }}
                              onClick={() => setSingleRevokeAssignment(item)}
                              styles={{ root: { padding: "4px 8px", height: "28px", color: "#a4262c" } }}
                            />
                          </Stack>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      )}

      {/* TAB 2: ASSIGNABLE USERS EXPLORER */}
      {activeTab === "explorer" && (
        <Stack tokens={{ childrenGap: 14 }}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center" tokens={{ childrenGap: 12 }}>
            <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Target Workspace:</span>
              <Dropdown
                selectedKey={explorerWorkspaceId}
                onChange={(_, opt) => setExplorerWorkspaceId((opt?.key as string) || "")}
                options={explorerWorkspaceOptions}
                styles={{ root: { width: 240 } }}
              />

              <SearchBox
                placeholder="Search Azure AD users by name or email..."
                value={explorerSearchQuery}
                onChange={(_, val) => setExplorerSearchQuery(val || "")}
                onClear={() => setExplorerSearchQuery("")}
                styles={{ root: { width: 280 } }}
              />
            </Stack>

            <DefaultButton text="Refresh Users" iconProps={{ iconName: "Refresh" }} onClick={fetchAssignableUsers} />
          </Stack>

          {loadingExplorer && <Spinner label="Querying Azure AD assignable users..." />}

          {explorerError && (
            <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setExplorerError(null)}>
              {explorerError}
            </MessageBar>
          )}

          {!loadingExplorer && !explorerError && assignableUsers.length === 0 && (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "#605e5c",
                background: "#faf9f8",
                borderRadius: "6px",
                border: "1px dashed #c8c6c4",
              }}
            >
              No assignable Azure AD users found for the selected criteria.
            </div>
          )}

          {!loadingExplorer && !explorerError && assignableUsers.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="tre-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#faf9f8", borderBottom: "2px solid #edebe9", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Azure AD User
                    </th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Azure AD Object ID
                    </th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Permissions Verification
                    </th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Active Roles
                    </th>
                    <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignableUsers.map((user) => {
                    const userRoleCount = assignments.filter((a) => a.userId === user.id).length;
                    return (
                      <tr key={user.id} style={{ borderBottom: "1px solid #f3f2f1" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <Persona
                            text={user.displayName}
                            secondaryText={user.userPrincipalName || user.mail}
                            size={PersonaSize.size32}
                          />
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: "monospace",
                            fontSize: "12px",
                            color: "#605e5c",
                          }}
                        >
                          {user.id}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              backgroundColor: "#dff6dd",
                              color: "#107c41",
                              border: "1px solid #92c894",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            <Icon iconName="CheckMark" style={{ marginRight: "4px" }} /> Verified AAD User
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "12px" }}>
                          {userRoleCount > 0 ? (
                            <span style={{ color: "#0078d4", fontWeight: 600 }}>{userRoleCount} workspace role(s)</span>
                          ) : (
                            <span style={{ color: "#605e5c" }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <PrimaryButton
                            text="Assign Workspace Role"
                            iconProps={{ iconName: "Add" }}
                            onClick={() => {
                              setAssignUserModalUser(user);
                              setTargetAssignWorkspaceId(explorerWorkspaceId);
                              setTargetAssignRoleId("WorkspaceResearcher");
                            }}
                            styles={{ root: { padding: "4px 10px", height: "30px" } }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      )}

      {/* DIALOG: BULK REVOKE */}
      <Dialog
        hidden={!showBulkRevokeDialog}
        onDismiss={() => setShowBulkRevokeDialog(false)}
        dialogContentProps={{
          title: "Confirm Bulk Role Revocation",
          subText: `Are you sure you want to revoke ${selectedAssignmentIds.size} selected role assignment(s) across workspaces? This will remove workspace permissions for the selected users.`,
        }}
      >
        {actionInProgress ? (
          <Spinner label="Revoking selected user role assignments..." />
        ) : (
          <DialogFooter>
            <PrimaryButton
              text="Yes, Revoke Access"
              onClick={handleExecuteBulkRevoke}
              styles={{ root: { backgroundColor: "#a4262c", borderColor: "#a4262c" } }}
            />
            <DefaultButton text="Cancel" onClick={() => setShowBulkRevokeDialog(false)} />
          </DialogFooter>
        )}
      </Dialog>

      {/* DIALOG: BULK REASSIGN */}
      <Dialog
        hidden={!showBulkReassignDialog}
        onDismiss={() => setShowBulkReassignDialog(false)}
        dialogContentProps={{
          title: "Bulk Role Reassignment",
          subText: `Select a new workspace role to assign to all ${selectedAssignmentIds.size} selected item(s).`,
        }}
      >
        <Stack tokens={{ childrenGap: 12 }} style={{ marginTop: "10px", marginBottom: "15px" }}>
          <Dropdown
            label="Target Workspace Role"
            selectedKey={targetBulkRole}
            onChange={(_, opt) => setTargetBulkRole((opt?.key as string) || "")}
            options={roleOptions}
            placeholder="Select target role..."
          />
        </Stack>
        {actionInProgress ? (
          <Spinner label="Reassigning workspace roles..." />
        ) : (
          <DialogFooter>
            <PrimaryButton text="Reassign Roles" onClick={handleExecuteBulkReassign} disabled={!targetBulkRole} />
            <DefaultButton text="Cancel" onClick={() => setShowBulkReassignDialog(false)} />
          </DialogFooter>
        )}
      </Dialog>

      {/* DIALOG: SINGLE REVOKE */}
      <Dialog
        hidden={!singleRevokeAssignment}
        onDismiss={() => setSingleRevokeAssignment(null)}
        dialogContentProps={{
          title: "Revoke User Access",
          subText: `Are you sure you want to revoke ${singleRevokeAssignment?.userDisplayName} from role ${singleRevokeAssignment?.roleDisplayName} in workspace ${singleRevokeAssignment?.workspaceName}?`,
        }}
      >
        {actionInProgress ? (
          <Spinner label="Revoking role assignment..." />
        ) : (
          <DialogFooter>
            <PrimaryButton
              text="Revoke Access"
              onClick={handleExecuteSingleRevoke}
              styles={{ root: { backgroundColor: "#a4262c", borderColor: "#a4262c" } }}
            />
            <DefaultButton text="Cancel" onClick={() => setSingleRevokeAssignment(null)} />
          </DialogFooter>
        )}
      </Dialog>

      {/* DIALOG: SINGLE REASSIGN */}
      <Dialog
        hidden={!singleReassignAssignment}
        onDismiss={() => setSingleReassignAssignment(null)}
        dialogContentProps={{
          title: "Reassign User Workspace Role",
          subText: `Reassign ${singleReassignAssignment?.userDisplayName} in ${singleReassignAssignment?.workspaceName}`,
        }}
      >
        <Stack tokens={{ childrenGap: 12 }} style={{ marginTop: "10px", marginBottom: "15px" }}>
          <Dropdown
            label="New Workspace Role"
            selectedKey={targetSingleRole}
            onChange={(_, opt) => setTargetSingleRole((opt?.key as string) || "")}
            options={roleOptions}
          />
        </Stack>
        {actionInProgress ? (
          <Spinner label="Reassigning role..." />
        ) : (
          <DialogFooter>
            <PrimaryButton text="Update Role" onClick={handleExecuteSingleReassign} disabled={!targetSingleRole} />
            <DefaultButton text="Cancel" onClick={() => setSingleReassignAssignment(null)} />
          </DialogFooter>
        )}
      </Dialog>

      {/* DIALOG: ASSIGN USER FROM EXPLORER */}
      <Dialog
        hidden={!assignUserModalUser}
        onDismiss={() => setAssignUserModalUser(null)}
        dialogContentProps={{
          title: "Assign Workspace Role",
          subText: `Assign workspace role for ${assignUserModalUser?.displayName} (${assignUserModalUser?.userPrincipalName})`,
        }}
      >
        <Stack tokens={{ childrenGap: 12 }} style={{ marginTop: "10px", marginBottom: "15px" }}>
          <Dropdown
            label="Target Workspace"
            selectedKey={targetAssignWorkspaceId}
            onChange={(_, opt) => setTargetAssignWorkspaceId((opt?.key as string) || "")}
            options={explorerWorkspaceOptions}
          />
          <Dropdown
            label="Role"
            selectedKey={targetAssignRoleId}
            onChange={(_, opt) => setTargetAssignRoleId((opt?.key as string) || "")}
            options={roleOptions}
          />
        </Stack>
        {actionInProgress ? (
          <Spinner label="Assigning user to workspace role..." />
        ) : (
          <DialogFooter>
            <PrimaryButton
              text="Assign User"
              onClick={handleExecuteAssignUser}
              disabled={!targetAssignWorkspaceId || !targetAssignRoleId}
            />
            <DefaultButton text="Cancel" onClick={() => setAssignUserModalUser(null)} />
          </DialogFooter>
        )}
      </Dialog>
    </Stack>
  );
};

export default UserAccessManagement;
