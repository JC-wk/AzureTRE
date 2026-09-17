import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../../test-utils";

const mockApiCall = vi.fn();

vi.mock("../../../hooks/useAuthApiCall", () => ({
  useAuthApiCall: () => mockApiCall,
  HttpMethod: {
    Get: "GET",
    Post: "POST",
    Delete: "DELETE",
    Put: "PUT",
  },
}));

// Mock FluentUI components for reliable testing in jsdom
vi.mock("@fluentui/react", async () => {
  const actual = await vi.importActual("@fluentui/react");
  return {
    ...actual,
    Stack: ({ children, horizontal, style, className }: any) => (
      <div data-testid="stack" data-horizontal={horizontal} style={style} className={className}>
        {children}
      </div>
    ),
    DefaultButton: ({ text, onClick, disabled }: any) => (
      <button onClick={onClick} disabled={disabled}>
        {text}
      </button>
    ),
    PrimaryButton: ({ text, onClick, disabled }: any) => (
      <button onClick={onClick} disabled={disabled}>
        {text}
      </button>
    ),
    Persona: ({ text, secondaryText }: any) => (
      <div>
        <span>{text}</span>
        {secondaryText && <span>{secondaryText}</span>}
      </div>
    ),
    SearchBox: ({ placeholder, value, onChange }: any) => (
      <input placeholder={placeholder} value={value} onChange={(e) => onChange && onChange(e, e.target.value)} />
    ),
    Dropdown: ({ options, selectedKey, onChange }: any) => (
      <select
        value={selectedKey}
        onChange={(e) => {
          const opt = options?.find((o: any) => o.key === e.target.value);
          onChange && onChange(e, opt);
        }}
      >
        {options?.map((o: any) => (
          <option key={o.key} value={o.key}>
            {o.text}
          </option>
        ))}
      </select>
    ),
    Spinner: ({ label }: any) => <div>{label || "Loading..."}</div>,
  };
});

import UserAccessManagement from "./UserAccessManagement";

describe("UserAccessManagement Component", () => {
  const mockWorkspaces = {
    workspaces: [
      {
        id: "ws-123",
        properties: { display_name: "Project Alpha" },
      },
      {
        id: "ws-456",
        properties: { display_name: "Project Beta" },
      },
    ],
  };

  const mockUsersWs1 = {
    users: [
      {
        id: "user-1",
        displayName: "Alice Smith",
        userPrincipalName: "alice@example.com",
        roles: [{ id: "WorkspaceOwner", displayName: "Workspace Owner" }],
      },
      {
        id: "user-2",
        displayName: "Bob Jones",
        userPrincipalName: "bob@example.com",
        roles: [{ id: "WorkspaceResearcher", displayName: "Workspace Researcher" }],
      },
    ],
  };

  const mockUsersWs2 = {
    users: [
      {
        id: "user-3",
        displayName: "Charlie Brown",
        userPrincipalName: "charlie@example.com",
        roles: [{ id: "AirlockManager", displayName: "Airlock Manager" }],
      },
    ],
  };

  const mockAssignableUsers = {
    assignable_users: [
      {
        id: "user-4",
        displayName: "Diana Prince",
        userPrincipalName: "diana@example.com",
        mail: "diana@example.com",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiCall.mockImplementation((endpoint: string) => {
      if (endpoint === "workspaces") {
        return Promise.resolve(mockWorkspaces);
      }
      if (endpoint.includes("ws-123/users")) {
        return Promise.resolve(mockUsersWs1);
      }
      if (endpoint.includes("ws-456/users")) {
        return Promise.resolve(mockUsersWs2);
      }
      if (endpoint.includes("assignable-users")) {
        return Promise.resolve(mockAssignableUsers);
      }
      return Promise.resolve({});
    });
  });

  it("renders header and main tabs", async () => {
    render(<UserAccessManagement onClose={vi.fn()} />);

    expect(screen.getByText(/Global User & Access Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Cross-Workspace User & Role Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Assignable Users Explorer/i)).toBeInTheDocument();
  });

  it("loads and displays cross-workspace user & role matrix data", async () => {
    render(<UserAccessManagement onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Project Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Project Beta").length).toBeGreaterThan(0);
  });

  it("filters matrix rows by search query", async () => {
    render(<UserAccessManagement onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search user, UPN, workspace, or role.../i);
    fireEvent.change(searchInput, { target: { value: "Alice" } });

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie Brown")).not.toBeInTheDocument();
  });

  it("switches to Assignable Users Explorer tab and loads users", async () => {
    render(<UserAccessManagement onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    const explorerTab = screen.getByText(/Assignable Users Explorer/i);
    fireEvent.click(explorerTab);

    await waitFor(() => {
      expect(screen.getByText("Diana Prince")).toBeInTheDocument();
    });

    expect(screen.getByText("Verified AAD User")).toBeInTheDocument();
    expect(screen.getByText("Assign Workspace Role")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", async () => {
    const handleClose = vi.fn();
    render(<UserAccessManagement onClose={handleClose} />);

    const closeBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
