import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../../test-utils";
import {
  TemplateViewerModal,
  computeLineDiff,
  computeSideBySideRows,
  highlightJsonTokens,
  getTemplateEndpoint,
  extractTemplateObject,
} from "./TemplateViewerModal";

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
      if (endpoint.startsWith("workspace-templates/tre-workspace-base")) {
        return Promise.resolve({
          workspaceTemplate: mockTemplates[0],
        });
      }
      return Promise.resolve([]);
    });
  },
  HttpMethod: {
    Get: "GET",
  },
}));

describe("getTemplateEndpoint", () => {
  it("formats version query endpoint for workspace templates", () => {
    const ep = getTemplateEndpoint("tre-workspace-axym", "0.2.37", "workspace");
    expect(ep).toBe("workspace-templates/tre-workspace-axym?version=0.2.37");
  });

  it("formats version query endpoint for workspace service templates", () => {
    const ep = getTemplateEndpoint("tre-service-guacamole", "1.0.0", "workspace-service");
    expect(ep).toBe("workspace-service-templates/tre-service-guacamole?version=1.0.0");
  });
});

describe("extractTemplateObject", () => {
  it("extracts workspaceTemplate wrapper", () => {
    const res = { workspaceTemplate: { name: "test", version: "1.0.0" } };
    expect(extractTemplateObject(res)).toEqual({ name: "test", version: "1.0.0" });
  });
});

describe("computeLineDiff & computeSideBySideRows", () => {
  it("correctly identifies added, removed, and unchanged lines", () => {
    const left = '{\n  "version": "1.0.0"\n}';
    const right = '{\n  "version": "1.1.0",\n  "newProp": true\n}';

    const diff = computeLineDiff(left, right);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.some((l) => l.type === "added")).toBe(true);
    expect(diff.some((l) => l.type === "removed")).toBe(true);

    const rows = computeSideBySideRows(diff);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("highlightJsonTokens", () => {
  it("tokenizes JSON key and string values", () => {
    const { container } = render(<>{highlightJsonTokens('"key": "value"')}</>);
    expect(container.textContent).toContain('"key": "value"');
  });
});

describe("TemplateViewerModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal header and template JSON", async () => {
    render(<TemplateViewerModal templateName="tre-workspace-base" initialVersion="1.0.0" onClose={mockOnClose} />);

    expect(screen.getByText(/Template Viewer/i)).toBeInTheDocument();

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
      expect(screen.getByText(/Side-by-Side Diff/i)).toBeInTheDocument();
      expect(screen.getByText(/Unified Diff/i)).toBeInTheDocument();
    });
  });
});
