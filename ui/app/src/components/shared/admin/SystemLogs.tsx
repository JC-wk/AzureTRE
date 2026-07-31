import React, { useEffect, useState, useCallback } from "react";
import {
  Stack,
  DefaultButton,
  PrimaryButton,
  SearchBox,
  Icon,
  Spinner,
  Modal,
  IconButton,
  Dropdown,
  IDropdownOption,
} from "@fluentui/react";
import { Operation, OperationStep } from "../../../models/operation";
import { useAuthApiCall, HttpMethod } from "../../../hooks/useAuthApiCall";

interface SystemLogsProps {
  onClose?: () => void;
}

const getLogLevelInfo = (status: string = "") => {
  const s = status.toLowerCase();
  if (s.includes("failed") || s.includes("error")) {
    return { level: "ERROR", bg: "#fde7e9", text: "#a4262c", border: "#f8a0a4", icon: "ErrorBadge" };
  }
  if (s.includes("awaiting") || s.includes("pending")) {
    return { level: "WARN", bg: "#fff4ce", text: "#797775", border: "#fce100", icon: "Warning" };
  }
  if (
    s.includes("deploying") ||
    s.includes("updating") ||
    s.includes("deleting") ||
    s.includes("running") ||
    s.includes("progress")
  ) {
    return { level: "INFO", bg: "#eff6fc", text: "#0078d4", border: "#c7e0f4", icon: "Sync" };
  }
  if (
    s.includes("deployed") ||
    s.includes("success") ||
    s.includes("updated") ||
    s.includes("deleted") ||
    s.includes("completed")
  ) {
    return { level: "SUCCESS", bg: "#dff6dd", text: "#107c41", border: "#92c353", icon: "Completed" };
  }
  return { level: "INFO", bg: "#f3f2f1", text: "#605e5c", border: "#e1dfdd", icon: "Info" };
};

const deriveSourceFromPath = (path: string = ""): string => {
  if (path.includes("/workspace-services/")) return "Workspace Service";
  if (path.includes("/user-resources/")) return "User Resource";
  if (path.includes("/shared-services/")) return "Shared Service";
  if (path.includes("/workspaces/")) return "Workspace";
  if (path.includes("/airlock/")) return "Airlock";
  return "System Core";
};

const formatLocaleDate = (timestampInSeconds: number): string => {
  if (!timestampInSeconds) return "N/A";
  const date = new Date(timestampInSeconds * 1000);
  const userLocale = typeof navigator !== "undefined" && (navigator.languages?.[0] || navigator.language);
  return date.toLocaleString(userLocale || undefined);
};

export const SystemLogs: React.FC<SystemLogsProps> = ({ onClose }) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("all");
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>("all");
  const [limit, setLimit] = useState<number>(100);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off
  const [copySuccess, setCopySuccess] = useState(false);

  const api = useAuthApiCall();

  const fetchLogs = useCallback(
    async (fetchLimit: number = limit) => {
      setLoading(true);
      try {
        // Try /operations/all (TRE Admin endpoint) first, fallback to /operations
        let data;
        try {
          data = await api(`/operations/all?limit=${fetchLimit}`, HttpMethod.Get);
        } catch {
          data = await api(`/operations?limit=${fetchLimit}`, HttpMethod.Get);
        }
        setOperations(data.operations || []);
      } catch (error) {
        console.error("Failed to fetch system logs", error);
      } finally {
        setLoading(false);
      }
    },
    [api, limit],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto refresh timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      fetchLogs();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchLogs]);

  const handleDeleteOperation = async (opId: string) => {
    if (!window.confirm(`Are you sure you want to delete log operation record ${opId}?`)) return;

    try {
      await api(`/operations/${opId}`, HttpMethod.Delete);
      setOperations((prev) => prev.filter((op) => op.id !== opId));
      if (selectedOperation?.id === opId) {
        setSelectedOperation(null);
      }
    } catch (error) {
      console.error("Failed to delete operation", error);
    }
  };

  const handleCopyLogToClipboard = (logText: string) => {
    navigator.clipboard.writeText(logText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadLogFile = () => {
    const formattedLogs = filteredOperations
      .map((op) => {
        const timestamp = new Date(op.updatedWhen * 1000).toISOString();
        const level = getLogLevelInfo(op.status).level;
        const source = deriveSourceFromPath(op.resourcePath);
        return `[${timestamp}] [${level}] [${source}] [OpID:${op.id}] [ResID:${op.resourceId}] [Action:${op.action}] ${op.message || op.status}`;
      })
      .join("\n");

    const blob = new Blob([formattedLogs], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `azuretre_system_logs_${new Date().toISOString().slice(0, 10)}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAzureLogAnalyticsUrl = (opId: string) => {
    return `https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/query/Traces%20%7C%20where%20message%20contains%20%22${opId}%22`;
  };

  // Filtering logic
  const nowInSeconds = Date.now() / 1000;

  const filteredOperations = operations.filter((op) => {
    const logInfo = getLogLevelInfo(op.status);
    const source = deriveSourceFromPath(op.resourcePath);

    // Search query filter
    const matchesSearch =
      searchQuery === "" ||
      op.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (op.message && op.message.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (op.user?.email && op.user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (op.steps &&
        op.steps.some((step) => step.stepTitle && step.stepTitle.toLowerCase().includes(searchQuery.toLowerCase())));

    // Level filter
    const matchesLevel =
      selectedLevelFilter === "all" || logInfo.level.toLowerCase() === selectedLevelFilter.toLowerCase();

    // Source filter
    const matchesSource = selectedSourceFilter === "all" || source.toLowerCase() === selectedSourceFilter.toLowerCase();

    // Time filter
    let matchesTime = true;
    if (selectedTimeFilter === "24h") {
      matchesTime = nowInSeconds - op.updatedWhen <= 86400;
    } else if (selectedTimeFilter === "7d") {
      matchesTime = nowInSeconds - op.updatedWhen <= 604800;
    } else if (selectedTimeFilter === "30d") {
      matchesTime = nowInSeconds - op.updatedWhen <= 2592000;
    }

    return matchesSearch && matchesLevel && matchesSource && matchesTime;
  });

  // Summary Metrics
  const errorCount = operations.filter((o) => getLogLevelInfo(o.status).level === "ERROR").length;
  const inProgressCount = operations.filter((o) => getLogLevelInfo(o.status).level === "INFO").length;
  const successCount = operations.filter((o) => getLogLevelInfo(o.status).level === "SUCCESS").length;

  const levelDropdownOptions: IDropdownOption[] = [
    { key: "all", text: "All Log Levels" },
    { key: "error", text: "ERROR / Failures" },
    { key: "warn", text: "WARN / Pending" },
    { key: "info", text: "INFO / Active" },
    { key: "success", text: "SUCCESS / Deployed" },
  ];

  const sourceDropdownOptions: IDropdownOption[] = [
    { key: "all", text: "All System Sources" },
    { key: "workspace", text: "Workspace" },
    { key: "workspace service", text: "Workspace Service" },
    { key: "user resource", text: "User Resource" },
    { key: "shared service", text: "Shared Service" },
    { key: "system core", text: "System Core" },
  ];

  const timeDropdownOptions: IDropdownOption[] = [
    { key: "all", text: "All Time Range" },
    { key: "24h", text: "Last 24 Hours" },
    { key: "7d", text: "Last 7 Days" },
    { key: "30d", text: "Last 30 Days" },
  ];

  const limitDropdownOptions: IDropdownOption[] = [
    { key: 100, text: "100 Recent Logs" },
    { key: 250, text: "250 Recent Logs" },
    { key: 500, text: "500 Recent Logs" },
  ];

  return (
    <Stack className="tre-panel tre-resource-panel" tokens={{ childrenGap: 16 }}>
      {/* Title & Header Bar */}
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
            <Icon iconName="Diagnostics" style={{ fontSize: "24px" }} /> Centralized System Log Viewer
          </h2>
          <div style={{ color: "#605e5c", fontSize: "13px", marginTop: "2px" }}>
            Consolidated real-time operational logs, deployment steps, system events, and pipeline diagnostics.
          </div>
        </div>
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <DefaultButton iconProps={{ iconName: "Refresh" }} text="Refresh Logs" onClick={() => fetchLogs()} />
          {onClose && <DefaultButton iconProps={{ iconName: "Cancel" }} text="Close" onClick={onClose} />}
        </Stack>
      </Stack>

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <div
          style={{ background: "#f3f2f1", borderRadius: "6px", padding: "12px 16px", borderLeft: "4px solid #0078d4" }}
        >
          <div style={{ fontSize: "12px", color: "#605e5c", fontWeight: 600 }}>Total System Logs</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#323130" }}>{operations.length}</div>
        </div>

        <div
          style={{ background: "#dff6dd", borderRadius: "6px", padding: "12px 16px", borderLeft: "4px solid #107c41" }}
        >
          <div style={{ fontSize: "12px", color: "#107c41", fontWeight: 600 }}>Deployed / Success</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#107c41" }}>{successCount}</div>
        </div>

        <div
          style={{ background: "#eff6fc", borderRadius: "6px", padding: "12px 16px", borderLeft: "4px solid #0078d4" }}
        >
          <div style={{ fontSize: "12px", color: "#0078d4", fontWeight: 600 }}>Active / In Progress</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#0078d4" }}>{inProgressCount}</div>
        </div>

        <div
          style={{ background: "#fde7e9", borderRadius: "6px", padding: "12px 16px", borderLeft: "4px solid #a4262c" }}
        >
          <div style={{ fontSize: "12px", color: "#a4262c", fontWeight: 600 }}>Errors / Failures</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#a4262c" }}>{errorCount}</div>
        </div>
      </div>

      {/* Control Bar: Search & Auto-Refresh */}
      <Stack
        horizontal
        horizontalAlign="space-between"
        verticalAlign="center"
        tokens={{ childrenGap: 12 }}
        style={{ flexWrap: "wrap" }}
      >
        <SearchBox
          placeholder="Search log text, IDs, users, or step titles..."
          value={searchQuery}
          onChange={(_, val) => setSearchQuery(val || "")}
          onClear={() => setSearchQuery("")}
          styles={{ root: { width: 340 } }}
        />

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <span style={{ fontSize: "12px", color: "#605e5c", fontWeight: 600 }}>Auto-Refresh:</span>
          {[0, 5, 15, 30].map((sec) => (
            <button
              key={sec}
              onClick={() => setAutoRefreshInterval(sec)}
              style={{
                border: "1px solid #c8c6c4",
                borderRadius: "12px",
                padding: "2px 10px",
                fontSize: "12px",
                fontWeight: autoRefreshInterval === sec ? 600 : 400,
                backgroundColor: autoRefreshInterval === sec ? "#0078d4" : "#ffffff",
                color: autoRefreshInterval === sec ? "#ffffff" : "#323130",
                cursor: "pointer",
              }}
            >
              {sec === 0 ? "Off" : `${sec}s`}
            </button>
          ))}
          {autoRefreshInterval > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                color: "#107c41",
                fontWeight: 600,
              }}
            >
              <Icon iconName="PreSync" className="spin-icon" style={{ animation: "spin 2s linear infinite" }} /> Live
            </span>
          )}
          <PrimaryButton
            iconProps={{ iconName: "Download" }}
            text="Export Log File"
            onClick={handleDownloadLogFile}
            disabled={filteredOperations.length === 0}
          />
        </Stack>
      </Stack>

      {/* Multi-Dimensional Filter Toolbar */}
      <Stack
        horizontal
        tokens={{ childrenGap: 12 }}
        style={{
          flexWrap: "wrap",
          backgroundColor: "#faf9f8",
          padding: "10px 14px",
          borderRadius: "6px",
          border: "1px solid #edebe9",
        }}
      >
        <Dropdown
          label="Log Level"
          selectedKey={selectedLevelFilter}
          onChange={(_, opt) => setSelectedLevelFilter((opt?.key as string) || "all")}
          options={levelDropdownOptions}
          styles={{ root: { width: 170 } }}
        />

        <Dropdown
          label="System Source"
          selectedKey={selectedSourceFilter}
          onChange={(_, opt) => setSelectedSourceFilter((opt?.key as string) || "all")}
          options={sourceDropdownOptions}
          styles={{ root: { width: 190 } }}
        />

        <Dropdown
          label="Time Window"
          selectedKey={selectedTimeFilter}
          onChange={(_, opt) => setSelectedTimeFilter((opt?.key as string) || "all")}
          options={timeDropdownOptions}
          styles={{ root: { width: 170 } }}
        />

        <Dropdown
          label="Max Logs"
          selectedKey={limit}
          onChange={(_, opt) => {
            const newLimit = (opt?.key as number) || 100;
            setLimit(newLimit);
            fetchLogs(newLimit);
          }}
          options={limitDropdownOptions}
          styles={{ root: { width: 160 } }}
        />
      </Stack>

      {/* Loading state */}
      {loading && <Spinner label="Aggregating system logs..." size={1} />}

      {/* Empty State */}
      {!loading && filteredOperations.length === 0 && (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            backgroundColor: "#faf9f8",
            borderRadius: "6px",
            color: "#605e5c",
          }}
        >
          <Icon iconName="SearchIssue" style={{ fontSize: "32px", color: "#a19f9d", marginBottom: "8px" }} />
          <div style={{ fontSize: "16px", fontWeight: 600 }}>No System Logs Match Your Filters</div>
          <div style={{ fontSize: "13px", marginTop: "4px" }}>
            Try adjusting your search terms, log level, or source filters.
          </div>
        </div>
      )}

      {/* Logs Table */}
      {!loading && filteredOperations.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="tre-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#faf9f8", borderBottom: "2px solid #edebe9", textAlign: "left" }}>
                <th style={{ padding: "10px", color: "#605e5c", fontSize: "12px" }}>Timestamp</th>
                <th style={{ padding: "10px", color: "#605e5c", fontSize: "12px" }}>Level / Status</th>
                <th style={{ padding: "10px", color: "#605e5c", fontSize: "12px" }}>Source</th>
                <th style={{ padding: "10px", color: "#605e5c", fontSize: "12px" }}>Action</th>
                <th style={{ padding: "10px", color: "#605e5c", fontSize: "12px" }}>Operation / Resource ID</th>
                <th style={{ padding: "10px", color: "#605e5c", fontSize: "12px" }}>Log Message / Status Info</th>
                <th style={{ padding: "10px", color: "#605e5c", fontSize: "12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.map((op) => {
                const logInfo = getLogLevelInfo(op.status);
                const source = deriveSourceFromPath(op.resourcePath);
                const timeStr = formatLocaleDate(op.updatedWhen);

                return (
                  <tr key={op.id} style={{ borderBottom: "1px solid #f3f2f1" }}>
                    <td style={{ padding: "10px", whiteSpace: "nowrap", color: "#605e5c", fontSize: "12px" }}>
                      {timeStr}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          backgroundColor: logInfo.bg,
                          color: logInfo.text,
                          border: `1px solid ${logInfo.border}`,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Icon iconName={logInfo.icon} style={{ fontSize: "11px" }} />
                        {op.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          backgroundColor: "#f3f2f1",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 500,
                        }}
                      >
                        {source}
                      </span>
                    </td>
                    <td style={{ padding: "10px", fontWeight: 500, textTransform: "capitalize" }}>{op.action}</td>
                    <td style={{ padding: "10px", fontFamily: "monospace", fontSize: "11px", color: "#0078d4" }}>
                      <div>Op: {op.id.substring(0, 8)}...</div>
                      <div style={{ color: "#605e5c" }}>Res: {op.resourceId.substring(0, 8)}...</div>
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        color: "#323130",
                        maxWidth: "320px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {op.message || op.status}
                      {op.steps && op.steps.length > 0 && (
                        <span style={{ marginLeft: "6px", fontSize: "11px", color: "#605e5c" }}>
                          ({op.steps.length} steps)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                      <Stack horizontal tokens={{ childrenGap: 6 }}>
                        <DefaultButton
                          text="Inspect"
                          iconProps={{ iconName: "Code" }}
                          styles={{ root: { height: 28, minWidth: 0, padding: "0 8px" } }}
                          onClick={() => setSelectedOperation(op)}
                        />
                        <IconButton
                          iconProps={{ iconName: "Delete" }}
                          title="Delete Operation Record"
                          onClick={() => handleDeleteOperation(op.id)}
                          styles={{ root: { height: 28, width: 28 } }}
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

      {/* Log Detail Inspector Modal */}
      {selectedOperation && (
        <Modal
          isOpen={!!selectedOperation}
          onDismiss={() => setSelectedOperation(null)}
          isBlocking={false}
          containerClassName="tre-modal-container"
        >
          <div style={{ padding: "24px", maxWidth: "800px", width: "90vw", maxHeight: "85vh", overflowY: "auto" }}>
            <Stack
              horizontal
              horizontalAlign="space-between"
              verticalAlign="center"
              style={{ borderBottom: "1px solid #edebe9", paddingBottom: "12px", marginBottom: "16px" }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  color: "#0078d4",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Icon iconName="Diagnostics" /> Log Details & Inspector
              </h3>
              <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
                <DefaultButton
                  iconProps={{ iconName: "OpenInNewWindow" }}
                  text="Open in Azure Log Analytics"
                  onClick={() =>
                    window.open(getAzureLogAnalyticsUrl(selectedOperation.id), "_blank", "noopener,noreferrer")
                  }
                  styles={{ root: { color: "#0078d4" } }}
                />
                <IconButton iconProps={{ iconName: "Cancel" }} onClick={() => setSelectedOperation(null)} />
              </Stack>
            </Stack>

            <Stack tokens={{ childrenGap: 16 }}>
              {/* Metadata Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "12px",
                  backgroundColor: "#faf9f8",
                  padding: "14px",
                  borderRadius: "6px",
                }}
              >
                <div>
                  <strong>Operation ID:</strong>{" "}
                  <span style={{ fontFamily: "monospace", color: "#0078d4" }}>{selectedOperation.id}</span>
                </div>
                <div>
                  <strong>Resource ID:</strong>{" "}
                  <span style={{ fontFamily: "monospace", color: "#605e5c" }}>{selectedOperation.resourceId}</span>
                </div>
                <div>
                  <strong>Action:</strong>{" "}
                  <span style={{ textTransform: "capitalize" }}>{selectedOperation.action}</span>
                </div>
                <div>
                  <strong>Status:</strong> {selectedOperation.status}
                </div>
                <div>
                  <strong>Resource Path:</strong>{" "}
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{selectedOperation.resourcePath}</span>
                </div>
                <div>
                  <strong>User:</strong> {selectedOperation.user?.email || selectedOperation.user?.name || "System"}
                </div>
                <div>
                  <strong>Created:</strong> {formatLocaleDate(selectedOperation.createdWhen)}
                </div>
                <div>
                  <strong>Updated:</strong> {formatLocaleDate(selectedOperation.updatedWhen)}
                </div>
              </div>

              {/* Message Banner */}
              {selectedOperation.message && (
                <div
                  style={{
                    backgroundColor: "#eff6fc",
                    borderLeft: "4px solid #0078d4",
                    padding: "10px 14px",
                    borderRadius: "4px",
                  }}
                >
                  <strong>Status Message:</strong> {selectedOperation.message}
                </div>
              )}

              {/* Step Execution Timeline */}
              {selectedOperation.steps && selectedOperation.steps.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#323130" }}>
                    Execution Pipeline Steps ({selectedOperation.steps.length})
                  </h4>
                  <div style={{ border: "1px solid #edebe9", borderRadius: "6px", overflow: "hidden" }}>
                    {selectedOperation.steps.map((step: OperationStep, idx: number) => {
                      const stepLog = getLogLevelInfo(step.status || "");
                      return (
                        <div
                          key={step.templateStepId || idx}
                          style={{
                            padding: "10px 14px",
                            borderBottom:
                              idx < (selectedOperation.steps?.length || 0) - 1 ? "1px solid #edebe9" : "none",
                            backgroundColor: idx % 2 === 0 ? "#ffffff" : "#faf9f8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "13px" }}>
                              {step.stepTitle || step.templateStepId || `Step ${idx + 1}`}
                            </div>
                            <div style={{ fontSize: "11px", color: "#605e5c", marginTop: "2px" }}>
                              Resource: {step.resourceTemplateName || step.resourceId || "Primary"} | Action:{" "}
                              {step.resourceAction || "N/A"}
                            </div>
                            {step.message && (
                              <div style={{ fontSize: "12px", color: "#323130", marginTop: "4px" }}>{step.message}</div>
                            )}
                          </div>
                          <span
                            style={{
                              backgroundColor: stepLog.bg,
                              color: stepLog.text,
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {step.status || "Unknown"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Raw JSON Log Dump */}
              <div>
                <Stack
                  horizontal
                  horizontalAlign="space-between"
                  verticalAlign="center"
                  style={{ marginBottom: "6px" }}
                >
                  <h4 style={{ margin: 0, fontSize: "14px", color: "#323130" }}>Raw JSON Log Payload</h4>
                  <DefaultButton
                    iconProps={{ iconName: copySuccess ? "CheckMark" : "Copy" }}
                    text={copySuccess ? "Copied!" : "Copy JSON"}
                    onClick={() => handleCopyLogToClipboard(JSON.stringify(selectedOperation, null, 2))}
                  />
                </Stack>
                <pre
                  style={{
                    backgroundColor: "#1e1e1e",
                    color: "#d4d4d4",
                    padding: "14px",
                    borderRadius: "6px",
                    overflowX: "auto",
                    maxHeight: "220px",
                    fontSize: "12px",
                    fontFamily: "Consolas, Monaco, monospace",
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selectedOperation, null, 2)}
                </pre>
              </div>
            </Stack>
          </div>
        </Modal>
      )}
    </Stack>
  );
};

export default SystemLogs;
