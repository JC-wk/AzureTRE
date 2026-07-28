import React, { useState } from "react";
import { Stack, DefaultButton, Icon } from "@fluentui/react";
import Operations from "./Operations";
import Templates from "./Templates";
import UserAccessManagement from "./UserAccessManagement";

const Admin: React.FC = () => {
  const [showOperations, setShowOperations] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

  return (
    <Stack className="tre-panel tre-admin-hub" tokens={{ childrenGap: 16 }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 600,
              color: "#0078d4",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Icon iconName="Admin" style={{ fontSize: "26px" }} /> Admin
          </h1>
          <div style={{ color: "#605e5c", fontSize: "14px", marginTop: "4px" }}>
            Manage resource templates, monitor operation logs, inspect deployment state, and audit user access matrix.
          </div>
        </div>
      </Stack>

      <p style={{ color: "Orange" }}>
        Warning: These admin functions are advanced and experimental, proceed with caution.
      </p>

      {!showOperations && !showTemplates && !showUserManagement && (
        <Stack tokens={{ childrenGap: 20 }}>
          <Stack horizontal tokens={{ childrenGap: 12 }} styles={{ root: { marginTop: 10 } }}>
            <DefaultButton text="Templates" onClick={() => setShowTemplates(true)} />
            <DefaultButton text="Operations" onClick={() => setShowOperations(true)} />
            <DefaultButton text="User & Access Management" onClick={() => setShowUserManagement(true)} />
          </Stack>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
              marginTop: "10px",
            }}
          >
            <div
              onClick={() => setShowTemplates(true)}
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #f3f9ff 100%)",
                border: "1px solid #c7e0f4",
                borderRadius: "8px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0, 120, 212, 0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
              }}
              className="tre-admin-card"
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}
              >
                <div
                  style={{
                    background: "#0078d415",
                    color: "#0078d4",
                    borderRadius: "50%",
                    width: "42px",
                    height: "42px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon iconName="PageList" style={{ fontSize: "20px" }} />
                </div>
                <span
                  style={{
                    background: "#e1dfdd",
                    color: "#323130",
                    borderRadius: "12px",
                    padding: "2px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Core Feature
                </span>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#106ebe" }}>Template Management</h3>
              <p style={{ margin: 0, color: "#605e5c", fontSize: "13px", lineHeight: "1.5" }}>
                Inspect registered resource templates across workspaces, services, and user resources. Delete unused
                versions or entire template suites.
              </p>
            </div>

            <div
              onClick={() => setShowOperations(true)}
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #f4fbf7 100%)",
                border: "1px solid #c2e8d3",
                borderRadius: "8px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(16, 124, 65, 0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
              }}
              className="tre-admin-card"
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}
              >
                <div
                  style={{
                    background: "#107c4115",
                    color: "#107c41",
                    borderRadius: "50%",
                    width: "42px",
                    height: "42px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon iconName="Processing" style={{ fontSize: "20px" }} />
                </div>
                <span
                  style={{
                    background: "#dff6dd",
                    color: "#107c41",
                    borderRadius: "12px",
                    padding: "2px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  System Audit
                </span>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#107c41" }}>Operations Management</h3>
              <p style={{ margin: 0, color: "#605e5c", fontSize: "13px", lineHeight: "1.5" }}>
                Monitor active deployment pipelines, review background resource operations, and purge obsolete or stuck
                operations.
              </p>
            </div>

            <div
              onClick={() => setShowUserManagement(true)}
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #fdf6ff 100%)",
                border: "1px solid #e3c2f0",
                borderRadius: "8px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(136, 23, 152, 0.08)",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
              }}
              className="tre-admin-card"
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}
              >
                <div
                  style={{
                    background: "#88179815",
                    color: "#881798",
                    borderRadius: "50%",
                    width: "42px",
                    height: "42px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon iconName="People" style={{ fontSize: "20px" }} />
                </div>
                <span
                  style={{
                    background: "#f3e5f5",
                    color: "#881798",
                    borderRadius: "12px",
                    padding: "2px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  RBAC Audit
                </span>
              </div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#881798" }}>User & Access Management</h3>
              <p style={{ margin: 0, color: "#605e5c", fontSize: "13px", lineHeight: "1.5" }}>
                Cross-workspace user & role matrix, bulk role reassignment or revocation, and assignable Azure AD users
                explorer.
              </p>
            </div>
          </div>
        </Stack>
      )}

      {showOperations && <Operations onClose={() => setShowOperations(false)} />}
      {showTemplates && <Templates onClose={() => setShowTemplates(false)} />}
      {showUserManagement && <UserAccessManagement onClose={() => setShowUserManagement(false)} />}
    </Stack>
  );
};

export default Admin;
