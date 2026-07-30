import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../../test-utils";
import { TemplateViewerModal, computeLineDiff } from "./TemplateViewerModal";

const mockTemplates = [
  {
    id: "tre-workspace-base-1.0.0",
    name: "tre-workspace-base",
    version: "1.0.0",
    title: "Base Workspace Template",
    description: "Base workspace for Azure TRE",
    resourceType: "workspace",
    current: false,
    properties: { display_name: "Base Workspace v1" },
  },
  {
    id: "tre-workspace-base-1.1.0",
    name: "tre-workspace-base",
    version: "1.1.0",
    title: "Base Workspace Template",
    description: "Base workspace for Azure TRE with new features",
    resourceType: "workspace",
    current: true,
    properties: { display_name: "Base Workspace v1.1", enable_firewall: true },
  },
];

vi.mock("../../../hooks/useAuthApiCall", () => ({
  useAuthApiCall: () => {
    return vi.fn().mockImplementation((endpoint: string) => {
      if (endpoint === "templates") {
        return Promise.resolve(mockTemplates);
      }
      return Promise.resolve([]);
    });
  },
  HttpMethod: {
    Get: "GET",
  },
}));

describe("computeLineDiff", () => {
  it("correctly identifies added, removed, and unchanged lines", () => {
    const left = '{\n  "version": "1.0.0"\n}';
    const right = '{\n  "version": "1.1.0",\n  "newProp": true\n}';

    const diff = computeLineDiff(left, right);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.some((l) => l.type === "added")).toBe(true);
    expect(diff.some((l) => l.type === "removed")).toBe(true);
    expect(diff.some((l) => l.type === "unchanged")).toBe(true);
  });
});

describe("TemplateViewerModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal header and template JSON", async () => {
    render(<TemplateViewerModal templateName="tre-workspace-base" initialVersion="1.0.0" onClose={mockOnClose} />);

    expect(screen.getByText("Template Viewer & Diff")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/tre-workspace-base/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", async () => {
    render(<TemplateViewerModal templateName="tre-workspace-base" initialVersion="1.0.0" onClose={mockOnClose} />);

    const closeButton = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calculates diff when compare version is provided", async () => {
    render(
      <TemplateViewerModal
        templateName="tre-workspace-base"
        initialVersion="1.0.0"
        compareVersion="1.1.0"
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Unified Diff/i)).toBeInTheDocument();
      expect(screen.getByText(/Side-by-Side/i)).toBeInTheDocument();
    });
  });
});
