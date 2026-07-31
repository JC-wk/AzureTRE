import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../../test-utils";
import { SystemLogs } from "./SystemLogs";

// Mock useAuthApiCall hook
const mockApiCall = vi.fn();
vi.mock("../../../hooks/useAuthApiCall", () => ({
  useAuthApiCall: () => mockApiCall,
  HttpMethod: {
    Get: "GET",
    Delete: "DELETE",
  },
}));

// Mock FluentUI components
vi.mock("@fluentui/react", async () => {
  const actual = await vi.importActual("@fluentui/react");
  return {
    ...actual,
    Stack: ({ children, horizontal, tokens, styles }: any) => (
      <div data-testid="stack" data-horizontal={horizontal ? "true" : "false"} style={styles?.root}>
        {children}
      </div>
    ),
    DefaultButton: ({ text, onClick, iconProps }: any) => (
      <button data-testid={`button-${(text || "icon").toLowerCase()}`} onClick={onClick}>
        {text}
      </button>
    ),
    PrimaryButton: ({ text, onClick }: any) => (
      <button data-testid={`primary-button-${(text || "btn").toLowerCase()}`} onClick={onClick}>
        {text}
      </button>
    ),
    SearchBox: ({ value, onChange, placeholder }: any) => (
      <input
        data-testid="search-box"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e, e.target.value)}
      />
    ),
    Spinner: ({ label }: any) => <div data-testid="spinner">{label}</div>,
    Icon: ({ iconName }: any) => <i data-testid={`icon-${iconName}`} />,
  };
});

const sampleOperations = [
  {
    id: "op-1-deployed",
    resourceId: "res-workspace-123",
    resourcePath: "/workspaces/res-workspace-123",
    status: "deployed",
    action: "install",
    message: "Workspace successfully deployed",
    createdWhen: 1600000000,
    updatedWhen: 1600000500,
    user: { email: "admin@example.com" },
    steps: [
      {
        id: "step-1",
        templateStepId: "main",
        stepTitle: "Main step for workspace",
        status: "deployed",
        message: "Step completed",
        updatedWhen: 1600000500,
      },
    ],
  },
  {
    id: "op-2-failed",
    resourceId: "res-service-456",
    resourcePath: "/workspaces/res-workspace-123/workspace-services/res-service-456",
    status: "failed",
    action: "install",
    message: "Deployment error in terraform apply",
    createdWhen: 1600001000,
    updatedWhen: 1600001500,
    user: { email: "user@example.com" },
    steps: [],
  },
];

describe("SystemLogs Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiCall.mockResolvedValue({ operations: sampleOperations });
  });

  it("renders centralized system log viewer title and metric cards", async () => {
    render(<SystemLogs />);

    await waitFor(() => {
      expect(screen.getByText("Centralized System Log Viewer")).toBeInTheDocument();
    });

    expect(screen.getByText("Total System Logs")).toBeInTheDocument();
    expect(screen.getByText("Deployed / Success")).toBeInTheDocument();
    expect(screen.getByText("Errors / Failures")).toBeInTheDocument();
  });

  it("fetches and renders operations log table entries", async () => {
    render(<SystemLogs />);

    await waitFor(() => {
      expect(screen.getByText("op-1-deployed")).toBeInTheDocument();
      expect(screen.getByText("op-2-failed")).toBeInTheDocument();
    });

    expect(screen.getByText("Workspace successfully deployed")).toBeInTheDocument();
    expect(screen.getByText("Deployment error in terraform apply")).toBeInTheDocument();
  });

  it("filters logs by search query", async () => {
    render(<SystemLogs />);

    await waitFor(() => {
      expect(screen.getByText("op-1-deployed")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("search-box");
    fireEvent.change(searchInput, { target: { value: "failed" } });

    expect(screen.queryByText("op-1-deployed")).not.toBeInTheDocument();
    expect(screen.getByText("op-2-failed")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    render(<SystemLogs onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByTestId("button-close")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("button-close"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
