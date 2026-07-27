import React, { useEffect, useState } from "react";
import { Stack, DefaultButton, SearchBox, Icon, Spinner } from "@fluentui/react";
import { Operation } from "../../../models/operation";
import { useAuthApiCall, HttpMethod } from "../../../hooks/useAuthApiCall";

interface OperationsProps {
  onClose: () => void;
}

const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "deployed":
    case "success":
    case "completed":
      return { bg: "#dff6dd", text: "#107c41", label: "Deployed" };
    case "awaiting_deployment":
    case "deploying":
    case "in_progress":
    case "updating":
      return { bg: "#fff4ce", text: "#797775", label: status };
    case "failed":
      return { bg: "#fde7e9", text: "#a4262c", label: "Failed" };
    case "deleting":
    case "deleted":
      return { bg: "#fff7ed", text: "#c2410c", label: status };
    default:
      return { bg: "#f3f2f1", text: "#605e5c", label: status };
  }
};

const Operations: React.FC<OperationsProps> = ({ onClose }) => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const api = useAuthApiCall();

  useEffect(() => {
    const fetchOperations = async () => {
      setLoading(true);
      try {
        const data = await api("/operations", HttpMethod.Get);
        setOperations(data.operations || []);
      } catch (error) {
        console.error("Failed to fetch operations", error);
        setOperations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOperations();
  }, [api]);

  const handleDelete = async (operationId: string) => {
    if (!window.confirm("Are you sure you want to delete this operation?")) return;

    try {
      await api(`/admin/operations/${operationId}`, HttpMethod.Delete);
      setOperations(operations.filter((op) => op.id !== operationId));
    } catch (error) {
      console.error("Failed to delete operation", error);
    }
  };

  const filteredOperations = operations.filter((op) => {
    const matchesSearch =
      searchQuery === "" ||
      op.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatusFilter === "all" || op.status.toLowerCase() === selectedStatusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <Stack className="tre-panel tre-resource-panel" tokens={{ childrenGap: 16 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <div>
          <h2
            style={{ margin: 0, fontSize: "22px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Icon iconName="Processing" style={{ color: "#107c41" }} /> Operations Management
          </h2>
        </div>
        <DefaultButton text="Close" onClick={onClose} iconProps={{ iconName: "Cancel" }} />
      </Stack>

      {/* Search & Filter Toolbar */}
      {!loading && operations.length > 0 && (
        <Stack
          horizontal
          horizontalAlign="space-between"
          verticalAlign="center"
          tokens={{ childrenGap: 12 }}
          style={{ flexWrap: "wrap" }}
        >
          <SearchBox
            placeholder="Search operations by ID or Resource ID..."
            value={searchQuery}
            onChange={(_, newValue) => setSearchQuery(newValue || "")}
            onClear={() => setSearchQuery("")}
            styles={{ root: { width: 320 } }}
          />

          <Stack horizontal tokens={{ childrenGap: 6 }}>
            {["all", "awaiting_deployment", "deployed", "failed", "deleting"].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatusFilter(status)}
                style={{
                  border: "none",
                  borderRadius: "16px",
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: selectedStatusFilter === status ? 600 : 400,
                  backgroundColor: selectedStatusFilter === status ? "#107c41" : "#f3f2f1",
                  color: selectedStatusFilter === status ? "#ffffff" : "#323130",
                  cursor: "pointer",
                  transition: "all 0.15s ease-in-out",
                }}
              >
                {status === "all" ? "All Operations" : status}
              </button>
            ))}
          </Stack>
        </Stack>
      )}

      {loading && <Spinner label="Loading operations..." />}

      {!loading && operations.length === 0 && (
        <div style={{ marginTop: 20, color: "#605e5c" }}>No active or past operations found.</div>
      )}

      {!loading && operations.length > 0 && filteredOperations.length === 0 && (
        <div style={{ marginTop: 20, color: "#605e5c", textAlign: "center", padding: "20px" }}>
          No operations match your search filter criteria.
        </div>
      )}

      {!loading && filteredOperations.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="tre-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#faf9f8", borderBottom: "2px solid #edebe9", textAlign: "left" }}>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>ID</th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>
                  Resource ID
                </th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Status</th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Action</th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Created</th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Updated</th>
                <th style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600, color: "#605e5c" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOperations.map((op: Operation) => {
                const badge = getStatusBadge(op.status);
                return (
                  <tr key={op.id} style={{ borderBottom: "1px solid #f3f2f1" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: "#0078d4" }}>
                      {op.id}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: "#605e5c" }}>
                      {op.resourceId}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.text,
                          padding: "2px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 600,
                          display: "inline-block",
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td
                      style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 500, textTransform: "capitalize" }}
                    >
                      {op.action}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#605e5c" }}>
                      {new Date(op.createdWhen * 1000).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#605e5c" }}>
                      {new Date(op.updatedWhen * 1000).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <DefaultButton
                        text="Delete"
                        onClick={() => handleDelete(op.id)}
                        iconProps={{ iconName: "Delete" }}
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
  );
};

export default Operations;
