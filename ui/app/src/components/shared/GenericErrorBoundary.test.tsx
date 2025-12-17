import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, createPartialFluentUIMock, act } from "../../test-utils";
import { GenericErrorBoundary } from "./GenericErrorBoundary";

// Mock FluentUI components using centralized utility
vi.mock("@fluentui/react", () => createPartialFluentUIMock(['MessageBar', 'Link', 'Icon']));

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div data-testid="success-content">No error</div>;
};

describe("GenericErrorBoundary Component", () => {
  // Suppress console.error for tests since we're intentionally triggering errors
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("renders children when there is no error", async () => {
    await act(async () => {
      render(
        <GenericErrorBoundary>
          <ThrowError shouldThrow={false} />
        </GenericErrorBoundary>
      );
    });

    expect(screen.getByTestId("success-content")).toBeInTheDocument();
    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("renders error message when child component throws", async () => {
    await act(async () => {
      render(
        <GenericErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GenericErrorBoundary>
      );
    });

    expect(screen.getByTestId("message-bar")).toBeInTheDocument();
    expect(screen.getByTestId("message-bar")).toHaveAttribute("data-type", "error");
    expect(screen.getByText("Uh oh!")).toBeInTheDocument();
    expect(screen.getByText(/This area encountered an error/)).toBeInTheDocument();
  });

  it("does not render children when error boundary is triggered", async () => {
    await act(async () => {
      render(
        <GenericErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GenericErrorBoundary>
      );
    });

    expect(screen.queryByTestId("success-content")).not.toBeInTheDocument();
  });

  it("logs error to console when error is caught", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");

    await act(async () => {
      render(
        <GenericErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GenericErrorBoundary>
      );
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "UNHANDLED EXCEPTION",
      expect.any(Error),
      expect.any(Object)
    );
  });

  it("shows helpful error message with debugging guidance", async () => {
    await act(async () => {
      render(
        <GenericErrorBoundary>
          <ThrowError shouldThrow={true} />
        </GenericErrorBoundary>
      );
    });

    expect(screen.getByText(/check your configuration and refresh/)).toBeInTheDocument();
    expect(screen.getByText(/Further debugging details can be found in the browser console/)).toBeInTheDocument();
  });

  it("renders multiple children correctly when no error", async () => {
    await act(async () => {
      render(
        <GenericErrorBoundary>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <ThrowError shouldThrow={false} />
        </GenericErrorBoundary>
      );
    });

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
    expect(screen.getByTestId("success-content")).toBeInTheDocument();
  });

  it("catches error from any child component", async () => {
    await act(async () => {
      render(
        <GenericErrorBoundary>
          <div data-testid="child-1">Child 1</div>
          <ThrowError shouldThrow={true} />
          <div data-testid="child-2">Child 2</div>
        </GenericErrorBoundary>
      );
    });

    // Should show error boundary UI instead of children
    expect(screen.getByTestId("message-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("child-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("child-2")).not.toBeInTheDocument();
  });
});
