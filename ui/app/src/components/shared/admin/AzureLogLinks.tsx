import React, { useState, useEffect } from "react";
import {
  Stack,
  DefaultButton,
  PrimaryButton,
  TextField,
  Dropdown,
  IDropdownOption,
  Icon,
  MessageBar,
  MessageBarType,
} from "@fluentui/react";
import { useAuthApiCall, HttpMethod } from "../../../hooks/useAuthApiCall";
import { Workspace } from "../../../models/workspace";

interface AzureLogLinksProps {
  onClose?: () => void;
}

/**
 * Generates an Azure Log Analytics deep link with pre-filled KQL query for Firewall logs by IP range(s).
 */
export const getWorkspaceFirewallLogsUrl = (addressSpaces: string[]) => {
  if (!addressSpaces || addressSpaces.length === 0) {
    const defaultKql = `AzureDiagnostics\n| where Category in ("AzureFirewallApplicationRule", "AzureFirewallNetworkRule")\n| project TimeGenerated, Category, Action, Protocol, SourceIP=SourceIp_s, TargetFQDN=FQDN_s, TargetIP=DestinationIp_s, TargetPort=DestinationPort_d\n| order by TimeGenerated desc`;
    return `https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/query/${encodeURIComponent(defaultKql)}`;
  }

  const rangeConditions = addressSpaces.map((cidr) => `ipv4_is_in_range(SourceIp_s, "${cidr.trim()}")`).join(" or ");

  const kql = [
    `AzureDiagnostics`,
    `| where Category in ("AzureFirewallApplicationRule", "AzureFirewallNetworkRule")`,
    `| where ${rangeConditions}`,
    `| project TimeGenerated, Category, Action, Protocol, SourceIP=SourceIp_s, TargetFQDN=FQDN_s, TargetIP=DestinationIp_s, TargetPort=DestinationPort_d`,
    `| order by TimeGenerated desc`,
  ].join("\n");

  return `https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/query/${encodeURIComponent(kql)}`;
};

/**
 * Generates an Azure Log Analytics deep link pre-filled with KQL for Entra ID (Azure AD) Sign-In logs by App Registration (Client ID).
 */
export const getAppRegistrationSignInLogsUrl = (clientId: string) => {
  if (!clientId) {
    const defaultKql = `SigninLogs\n| project TimeGenerated, UserPrincipalName, AppDisplayName, ResourceDisplayName, IPAddress, Status, ResultType\n| order by TimeGenerated desc`;
    return `https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/query/${encodeURIComponent(defaultKql)}`;
  }

  const kql = [
    `SigninLogs`,
    `| where AppId == "${clientId.trim()}" or ResourceAppId == "${clientId.trim()}"`,
    `| project TimeGenerated, UserPrincipalName, UserDisplayName, AppDisplayName, ResourceDisplayName, IPAddress, Location, Status, ResultType, ResultDescription`,
    `| order by TimeGenerated desc`,
  ].join("\n");

  return `https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/LogsBlade/query/${encodeURIComponent(kql)}`;
};

/**
 * Direct link to Microsoft Entra ID App Registration overview page.
 */
export const getEntraAppRegistrationUrl = (clientId: string) => {
  return `https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Overview/appId/${encodeURIComponent(clientId.trim())}`;
};

/**
 * Direct link to Azure Resource Group overview.
 */
export const getAzureResourceGroupUrl = (resourceGroupName: string, subscriptionId?: string) => {
  if (subscriptionId) {
    return `https://portal.azure.com/#resource/subscriptions/${subscriptionId}/resourceGroups/${encodeURIComponent(resourceGroupName.trim())}/overview`;
  }
  return `https://portal.azure.com/#blade/HubsExtension/BrowseResourceGroups/resourceGroup/${encodeURIComponent(resourceGroupName.trim())}`;
};

export const AzureLogLinks: React.FC<AzureLogLinksProps> = ({ onClose }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [customIpRange, setCustomIpRange] = useState<string>("");
  const [customClientId, setCustomClientId] = useState<string>("");
  const [customRgName, setCustomRgName] = useState<string>("");
  const [copiedKql, setCopiedKql] = useState<string | null>(null);
  const api = useAuthApiCall();

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const data = await api("/workspaces", HttpMethod.Get);
        setWorkspaces(data.workspaces || []);
        if (data.workspaces && data.workspaces.length > 0) {
          setSelectedWorkspaceId(data.workspaces[0].id);
        }
      } catch (err) {
        console.error("Failed to load workspaces for log links generator", err);
      }
    };
    fetchWorkspaces();
  }, [api]);

  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  // Extract address spaces for selected workspace
  const workspaceAddressSpaces: string[] = selectedWorkspace
    ? selectedWorkspace.properties?.address_spaces ||
      (selectedWorkspace.properties?.address_space ? [selectedWorkspace.properties.address_space] : [])
    : customIpRange
      ? customIpRange.split(",").map((s) => s.trim())
      : [];

  const workspaceClientId: string = selectedWorkspace ? selectedWorkspace.properties?.client_id || "" : customClientId;

  const workspaceRgName: string = selectedWorkspace
    ? selectedWorkspace.properties?.resource_group_name || `rg-${selectedWorkspace.id}`
    : customRgName;

  const firewallKql = getWorkspaceFirewallLogsUrl(workspaceAddressSpaces).split("/query/")[1];
  const decodedFirewallKql = firewallKql ? decodeURIComponent(firewallKql) : "";

  const signInKql = getAppRegistrationSignInLogsUrl(workspaceClientId).split("/query/")[1];
  const decodedSignInKql = signInKql ? decodeURIComponent(signInKql) : "";

  const workspaceOptions: IDropdownOption[] = [
    ...workspaces.map((w) => ({
      key: w.id,
      text: `${w.properties?.display_name || w.id} (${w.id.substring(0, 8)}...)`,
    })),
    { key: "custom", text: "Custom / Manual Input" },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKql(label);
    setTimeout(() => setCopiedKql(null), 2500);
  };

  return (
    <Stack className="tre-panel tre-resource-panel" tokens={{ childrenGap: 20 }}>
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
            <Icon iconName="CloudSearch" style={{ fontSize: "24px" }} /> Azure Portal Diagnostic & Log Links
          </h2>
          <div style={{ color: "#605e5c", fontSize: "13px", marginTop: "2px" }}>
            Generate deep-links to Azure Log Analytics with pre-populated KQL queries for Firewall logs by IP range,
            Entra ID Sign-In logs by App Registration, and Resource Groups.
          </div>
        </div>
        {onClose && <DefaultButton iconProps={{ iconName: "Cancel" }} text="Close" onClick={onClose} />}
      </Stack>

      {/* Workspace / Input Selector */}
      <div style={{ backgroundColor: "#faf9f8", padding: "16px", borderRadius: "8px", border: "1px solid #edebe9" }}>
        <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="end" style={{ flexWrap: "wrap" }}>
          <Dropdown
            label="Select Workspace Context"
            selectedKey={selectedWorkspaceId || "custom"}
            onChange={(_, opt) => setSelectedWorkspaceId((opt?.key as string) || "custom")}
            options={workspaceOptions}
            styles={{ root: { width: 320 } }}
          />

          {selectedWorkspaceId === "custom" && (
            <>
              <TextField
                label="Custom CIDR IP Range(s)"
                placeholder="e.g. 10.1.0.0/24, 10.1.1.0/24"
                value={customIpRange}
                onChange={(_, val) => setCustomIpRange(val || "")}
                styles={{ root: { width: 240 } }}
              />
              <TextField
                label="Custom App Client ID"
                placeholder="App Registration Client ID"
                value={customClientId}
                onChange={(_, val) => setCustomClientId(val || "")}
                styles={{ root: { width: 240 } }}
              />
              <TextField
                label="Custom Resource Group"
                placeholder="e.g. rg-my-workspace"
                value={customRgName}
                onChange={(_, val) => setCustomRgName(val || "")}
                styles={{ root: { width: 200 } }}
              />
            </>
          )}
        </Stack>

        {selectedWorkspace && (
          <div
            style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "#605e5c",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <span>
              <strong>IP Range(s):</strong>{" "}
              {workspaceAddressSpaces.length > 0 ? workspaceAddressSpaces.join(", ") : "N/A"}
            </span>
            <span>
              <strong>App Client ID:</strong> {workspaceClientId || "Not specified"}
            </span>
            <span>
              <strong>Resource Group:</strong> {workspaceRgName}
            </span>
          </div>
        )}
      </div>

      {copiedKql && (
        <MessageBar messageBarType={MessageBarType.success} isMultiline={false}>
          Copied {copiedKql} KQL query to clipboard!
        </MessageBar>
      )}

      {/* Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "16px" }}>
        {/* Card 1: Firewall Logs by Workspace IP */}
        <div style={{ border: "1px solid #c7e0f4", borderRadius: "8px", padding: "18px", backgroundColor: "#ffffff" }}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: "10px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                color: "#0078d4",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Icon iconName="Shield" /> Azure Firewall Logs (By IP Range)
            </h3>
            <span
              style={{
                fontSize: "11px",
                backgroundColor: "#eff6fc",
                color: "#0078d4",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              Network & FQDNs
            </span>
          </Stack>
          <p style={{ fontSize: "13px", color: "#605e5c", margin: "0 0 12px 0" }}>
            Pre-populates Azure Log Analytics with Kusto query for HTTP/HTTPS FQDNs, DNS names, and destination IPs
            requested by this workspace.
          </p>

          <pre
            style={{
              backgroundColor: "#1e1e1e",
              color: "#9cdcfe",
              padding: "10px",
              borderRadius: "6px",
              fontSize: "11px",
              overflowX: "auto",
              maxHeight: "110px",
              margin: "0 0 12px 0",
            }}
          >
            {decodedFirewallKql}
          </pre>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <PrimaryButton
              text="Open Firewall Logs in Azure"
              iconProps={{ iconName: "OpenInNewWindow" }}
              onClick={() =>
                window.open(getWorkspaceFirewallLogsUrl(workspaceAddressSpaces), "_blank", "noopener,noreferrer")
              }
            />
            <DefaultButton
              text="Copy KQL"
              iconProps={{ iconName: "Copy" }}
              onClick={() => copyToClipboard(decodedFirewallKql, "Firewall")}
            />
          </Stack>
        </div>

        {/* Card 2: App Registration Sign-In Logs */}
        <div style={{ border: "1px solid #e3c2f0", borderRadius: "8px", padding: "18px", backgroundColor: "#ffffff" }}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: "10px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                color: "#881798",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Icon iconName="AuthenticatorApp" /> Sign-In Logs (App Registration)
            </h3>
            <span
              style={{
                fontSize: "11px",
                backgroundColor: "#f3e5f5",
                color: "#881798",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              Entra ID Auth
            </span>
          </Stack>
          <p style={{ fontSize: "13px", color: "#605e5c", margin: "0 0 12px 0" }}>
            Traces Microsoft Entra ID (Azure AD) sign-in events, authentication attempts, user sessions, and status for
            this App Registration.
          </p>

          <pre
            style={{
              backgroundColor: "#1e1e1e",
              color: "#ce9178",
              padding: "10px",
              borderRadius: "6px",
              fontSize: "11px",
              overflowX: "auto",
              maxHeight: "110px",
              margin: "0 0 12px 0",
            }}
          >
            {decodedSignInKql}
          </pre>

          <Stack horizontal tokens={{ childrenGap: 8 }} style={{ flexWrap: "wrap" }}>
            <PrimaryButton
              text="Open Sign-In Logs in Azure"
              iconProps={{ iconName: "OpenInNewWindow" }}
              onClick={() =>
                window.open(getAppRegistrationSignInLogsUrl(workspaceClientId), "_blank", "noopener,noreferrer")
              }
            />
            {workspaceClientId && (
              <DefaultButton
                text="View App Registration in Entra"
                iconProps={{ iconName: "ContactList" }}
                onClick={() =>
                  window.open(getEntraAppRegistrationUrl(workspaceClientId), "_blank", "noopener,noreferrer")
                }
              />
            )}
            <DefaultButton
              text="Copy KQL"
              iconProps={{ iconName: "Copy" }}
              onClick={() => copyToClipboard(decodedSignInKql, "Sign-In")}
            />
          </Stack>
        </div>

        {/* Card 3: Resource Group & Deployment Cleanup Links */}
        <div style={{ border: "1px solid #c2e8d3", borderRadius: "8px", padding: "18px", backgroundColor: "#ffffff" }}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ marginBottom: "10px" }}>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                color: "#107c41",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Icon iconName="ResourceGroup" /> Resource Group & Deploy Cleanup
            </h3>
            <span
              style={{
                fontSize: "11px",
                backgroundColor: "#dff6dd",
                color: "#107c41",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              Azure ARM
            </span>
          </Stack>
          <p style={{ fontSize: "13px", color: "#605e5c", margin: "0 0 12px 0" }}>
            Quick portal links to inspect left-behind or failed deployment Resource Groups (`{workspaceRgName}`)
            directly in Azure Portal.
          </p>

          <div
            style={{
              padding: "12px",
              backgroundColor: "#faf9f8",
              borderRadius: "6px",
              fontSize: "12px",
              margin: "0 0 12px 0",
            }}
          >
            <div>
              <strong>Resource Group Name:</strong> <code style={{ color: "#107c41" }}>{workspaceRgName}</code>
            </div>
            <div style={{ color: "#605e5c", marginTop: "4px" }}>
              Allows manual cleanup or inspection of resources left behind after deployment failures.
            </div>
          </div>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <PrimaryButton
              text="Open Resource Group in Portal"
              iconProps={{ iconName: "OpenInNewWindow" }}
              onClick={() => window.open(getAzureResourceGroupUrl(workspaceRgName), "_blank", "noopener,noreferrer")}
            />
          </Stack>
        </div>
      </div>
    </Stack>
  );
};

export default AzureLogLinks;
