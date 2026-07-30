import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../../test-utils";
import { UpgradableResources } from "./UpgradableResources";
import { ResourceType } from "../../../models/resourceType";

const mockWorkspaces = {
  workspaces: [
    {
      id: "ws-1",
      resourceType: ResourceType.Workspace,
      templateName: "tre-workspace-base",
      templateVersion: "1.0.0",
      isEnabled: true,
      deploymentStatus: "deployed",
      resourcePath: "/workspaces/ws-1",
      _etag: "etag-ws1",
      properties: { display_name: "Research Workspace Alpha", scope_id: "scope-ws1" },
      availableUpgrades: [{ version: "1.1.0", forceUpdateRequired: false }],
    },
    {
      id: "ws-2",
      resourceType: ResourceType.Workspace,
      templateName: "tre-workspace-base",
      templateVersion: "2.0.0",
      isEnabled: true,
      deploymentStatus: "deployed",
      resourcePath: "/workspaces/ws-2",
      _etag: "etag-ws2",
      properties: { display_name: "Production Workspace Beta" },
      availableUpgrades: [],
    },
  ],
};

const mockSharedServices = {
  sharedServices: [
    {
      id: "ss-1",
      resourceType: ResourceType.SharedService,
      templateName: "tre-shared-gitea",
      templateVersion: "1.0.0",
      isEnabled: true,
      deploymentStatus: "deployed",
      resourcePath: "/shared-services/ss-1",
      _etag: "etag-ss1",
      properties: { display_name: "Global Gitea Service" },
      availableUpgrades: [{ version: "1.2.0", forceUpdateRequired: false }],
    },
  ],
};

const mockWorkspaceServices = {
  workspaceServices: [
    {
      id: "wss-1",
      resourceType: ResourceType.WorkspaceService,
      templateName: "tre-service-guacamole",
      templateVersion: "1.0.0",
      isEnabled: true,
      deploymentStatus: "deployed",
      resourcePath: "/workspaces/ws-1/workspace-services/wss-1",
      _etag: "etag-wss1",
      properties: { display_name: "Guacamole Bastion" },
      availableUpgrades: [
        { version: "1.1.0", forceUpdateRequired: false },
        { version: "2.0.0", forceUpdateRequired: true },
      ],
    },
  ],
};

const mockUserResources = {
  userResources: [
    {
      id: "ur-1",
      resourceType: ResourceType.UserResource,
      templateName: "tre-user-linux-vm",
      templateVersion: "1.0.0",
      isEnabled: true,
      deploymentStatus: "deployed",
      resourcePath: "/workspaces/ws-1/workspace-services/wss-1/user-resources/ur-1",
      _etag: "etag-ur1",
      properties: { display_name: "Data Science VM" },
      availableUpgrades: [{ version: "1.0.1", forceUpdateRequired: false }],
    },
  ],
};

// Mock useAuthApiCall hook
const mockApiCall = vi.fn();

vi.mock("../../../hooks/useAuthApiCall", () => ({
  useAuthApiCall: () => mockApiCall,
  HttpMethod: {
    Get: "GET",
    Post: "POST",
    Patch: "PATCH",
    Delete: "DELETE",
  },
  ResultType: {
    JSON: "JSON",
    None: "None",
  },
}));

describe("UpgradableResources Component", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiCall.mockImplementation((endpoint: string) => {
      if (endpoint === "workspaces") {
        return Promise.resolve(mockWorkspaces);
      }
      if (endpoint === "shared-services") {
        return Promise.resolve(mockSharedServices);
      }
      if (endpoint === "workspaces/ws-1/workspace-services") {
        return Promise.resolve(mockWorkspaceServices);
      }
      if (endpoint === "workspaces/ws-2/workspace-services") {
        return Promise.resolve({ workspaceServices: [] });
      }
      if (endpoint === "workspaces/ws-1/workspace-services/wss-1/user-resources") {
        return Promise.resolve(mockUserResources);
      }
      return Promise.resolve({});
    });
  });

  it("renders the header and title", async () => {
    render(<UpgradableResources onClose={mockOnClose} />);

    expect(screen.getByText("Upgradable Components & Workspaces")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Single view to inspect, monitor, and upgrade all workspaces, shared services, workspace services, and user resources with available template updates.",
      ),
    ).toBeInTheDocument();
  });

  it("fetches and displays upgradable components and KPI stats", async () => {
    render(<UpgradableResources onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getAllByText("Research Workspace Alpha").length).toBeGreaterThan(0);
      expect(screen.getByText("Global Gitea Service")).toBeInTheDocument();
      expect(screen.getByText("Guacamole Bastion")).toBeInTheDocument();
      expect(screen.getByText("Data Science VM")).toBeInTheDocument();
    });

    // 4 upgradable components out of 5 total components
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", async () => {
    render(<UpgradableResources onClose={mockOnClose} />);

    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("filters items by search query", async () => {
    render(<UpgradableResources onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getAllByText("Research Workspace Alpha").length).toBeGreaterThan(0);
    });

    const searchBox = screen.getByPlaceholderText("Search component, template, workspace...");
    fireEvent.change(searchBox, { target: { value: "Guacamole" } });

    await waitFor(() => {
      expect(screen.getByText("Guacamole Bastion")).toBeInTheDocument();
      expect(screen.queryByText("Global Gitea Service")).not.toBeInTheDocument();
    });
  });

  it("toggles view filter between Upgradable Only and All Components", async () => {
    render(<UpgradableResources onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getAllByText("Research Workspace Alpha").length).toBeGreaterThan(0);
      expect(screen.queryByText("Production Workspace Beta")).not.toBeInTheDocument();
    });

    // Switch to All Components view
    const allComponentsButton = screen.getByRole("button", { name: /All Components/i });
    fireEvent.click(allComponentsButton);

    await waitFor(() => {
      expect(screen.getByText("Production Workspace Beta")).toBeInTheDocument();
    });
  });

  it("renders upgrade buttons for components with available upgrades", async () => {
    render(<UpgradableResources onClose={mockOnClose} />);

    await waitFor(() => {
      const upgradeButtons = screen.getAllByRole("button", { name: /Upgrade/i });
      expect(upgradeButtons.length).toBeGreaterThan(0);
    });
  });
});
