import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../../test-utils";
import {
  AzureLogLinks,
  getWorkspaceFirewallLogsUrl,
  getAppRegistrationSignInLogsUrl,
  getEntraAppRegistrationUrl,
  getAzureResourceGroupUrl,
} from "./AzureLogLinks";

const mockApiCall = vi.fn();
vi.mock("../../../hooks/useAuthApiCall", () => ({
  useAuthApiCall: () => mockApiCall,
  HttpMethod: {
    Get: "GET",
  },
}));

vi.mock("@fluentui/react", async () => {
  const actual = await vi.importActual("@fluentui/react");
  return {
    ...actual,
    Stack: ({ children }: any) => <div data-testid="stack">{children}</div>,
    DefaultButton: ({ text, onClick }: any) => (
      <button data-testid={`button-${(text || "btn").toLowerCase().replace(/[^a-z0-9]/g, "-")}`} onClick={onClick}>
        {text}
      </button>
    ),
    PrimaryButton: ({ text, onClick }: any) => (
      <button
        data-testid={`primary-button-${(text || "btn").toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
        onClick={onClick}
      >
        {text}
      </button>
    ),
    Dropdown: ({ label, options, selectedKey, onChange }: any) => (
      <select
        aria-label={label}
        data-testid="dropdown-workspace"
        value={selectedKey}
        onChange={(e) =>
          onChange?.(
            e,
            options.find((o: any) => o.key === e.target.value),
          )
        }
      >
        {options.map((o: any) => (
          <option key={o.key} value={o.key}>
            {o.text}
          </option>
        ))}
      </select>
    ),
    TextField: ({ label, value, onChange, placeholder }: any) => (
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e, e.target.value)}
      />
    ),
    Icon: ({ iconName }: any) => <i data-testid={`icon-${iconName}`} />,
    MessageBar: ({ children }: any) => <div data-testid="message-bar">{children}</div>,
  };
});

const sampleWorkspaces = [
  {
    id: "ws-12345678-abcd",
    templateName: "tre-workspace-base",
    templateVersion: "1.0",
    etag: "x",
    resourcePath: "/workspaces/ws-12345678-abcd",
    properties: {
      display_name: "Research Workspace Alpha",
      address_spaces: ["10.1.0.0/24"],
      client_id: "client-id-12345",
      resource_group_name: "rg-ws-12345678-abcd",
    },
  },
];

describe("AzureLogLinks Helper Functions", () => {
  it("generates correct Firewall KQL Log Analytics URL for IP ranges", () => {
    const url = getWorkspaceFirewallLogsUrl(["10.1.0.0/24", "10.1.1.0/24"]);
    expect(url).toContain("portal.azure.com");
    expect(url).toContain("AzureDiagnostics");
    expect(url).toContain(encodeURIComponent('ipv4_is_in_range(SourceIp_s, "10.1.0.0/24")'));
  });

  it("generates correct Sign-In KQL Log Analytics URL for App Registration Client ID", () => {
    const url = getAppRegistrationSignInLogsUrl("client-id-9999");
    expect(url).toContain("portal.azure.com");
    expect(url).toContain("SigninLogs");
    expect(url).toContain(encodeURIComponent('AppId == "client-id-9999"'));
  });

  it("generates correct Entra ID App Registration overview URL", () => {
    const url = getEntraAppRegistrationUrl("client-id-9999");
    expect(url).toBe(
      "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Overview/appId/client-id-9999",
    );
  });

  it("generates correct Resource Group URL", () => {
    const url = getAzureResourceGroupUrl("rg-workspace-test", "sub-123");
    expect(url).toBe(
      "https://portal.azure.com/#resource/subscriptions/sub-123/resourceGroups/rg-workspace-test/overview",
    );
  });
});

describe("AzureLogLinks Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockResolvedValue({ workspaces: sampleWorkspaces });
  });

  it("renders header title and workspace selector", async () => {
    render(<AzureLogLinks />);

    await waitFor(() => {
      expect(screen.getByText("Azure Portal Diagnostic & Log Links")).toBeInTheDocument();
    });

    expect(screen.getByText("Azure Firewall Logs (By IP Range)")).toBeInTheDocument();
    expect(screen.getByText("Sign-In Logs (App Registration)")).toBeInTheDocument();
    expect(screen.getByText("Resource Group & Deploy Cleanup")).toBeInTheDocument();
  });

  it("opens portal deep links on button click", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<AzureLogLinks />);

    await waitFor(() => {
      expect(screen.getByTestId("primary-button-open-firewall-logs-in-azure")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("primary-button-open-firewall-logs-in-azure"));
    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining("portal.azure.com"),
      "_blank",
      "noopener,noreferrer",
    );

    windowOpenSpy.mockRestore();
  });

  it("triggers onClose callback when close button is clicked", async () => {
    const handleClose = vi.fn();
    render(<AzureLogLinks onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByTestId("button-close")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("button-close"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
