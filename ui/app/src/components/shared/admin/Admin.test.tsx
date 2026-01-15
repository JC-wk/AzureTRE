import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test-utils';

// Mock child components
vi.mock('./Operations', () => ({
  default: ({ onClose }: any) => (
    <div data-testid="operations-component">
      <span>Operations Component</span>
      <button onClick={onClose}>Close Operations</button>
    </div>
  ),
}));

vi.mock('./Templates', () => ({
  default: ({ onClose }: any) => (
    <div data-testid="templates-component">
      <span>Templates Component</span>
      <button onClick={onClose}>Close Templates</button>
    </div>
  ),
}));

// Mock FluentUI components
vi.mock('@fluentui/react', async () => {
  const actual = await vi.importActual('@fluentui/react');
  return {
    ...actual,
    Stack: ({ children, horizontal, tokens, styles }: any) => (
      <div
        data-testid="stack"
        data-horizontal={horizontal ? 'true' : 'false'}
        style={styles?.root}
      >
        {children}
      </div>
    ),
    DefaultButton: ({ text, onClick }: any) => (
      <button data-testid={`button-${text.toLowerCase()}`} onClick={onClick}>
        {text}
      </button>
    ),
  };
});

// Import component after mocks
import Admin from './Admin';

describe('Admin Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the admin panel with title and warning', () => {
    render(<Admin />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Warning: These admin functions are advanced and experimental, proceed with caution.'
      )
    ).toBeInTheDocument();
  });

  it('displays Operations and Templates buttons initially', () => {
    render(<Admin />);

    expect(screen.getByTestId('button-operations')).toBeInTheDocument();
    expect(screen.getByTestId('button-templates')).toBeInTheDocument();
  });

  it('shows Operations component when Operations button is clicked', () => {
    render(<Admin />);

    const operationsButton = screen.getByTestId('button-operations');
    fireEvent.click(operationsButton);

    expect(screen.getByTestId('operations-component')).toBeInTheDocument();
    expect(screen.getByText('Operations Component')).toBeInTheDocument();
  });

  it('shows Templates component when Templates button is clicked', () => {
    render(<Admin />);

    const templatesButton = screen.getByTestId('button-templates');
    fireEvent.click(templatesButton);

    expect(screen.getByTestId('templates-component')).toBeInTheDocument();
    expect(screen.getByText('Templates Component')).toBeInTheDocument();
  });

  it('hides main buttons when Operations is shown', () => {
    render(<Admin />);

    const operationsButton = screen.getByTestId('button-operations');
    fireEvent.click(operationsButton);

    expect(screen.queryByTestId('button-operations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('button-templates')).not.toBeInTheDocument();
  });

  it('hides main buttons when Templates is shown', () => {
    render(<Admin />);

    const templatesButton = screen.getByTestId('button-templates');
    fireEvent.click(templatesButton);

    expect(screen.queryByTestId('button-operations')).not.toBeInTheDocument();
    expect(screen.queryByTestId('button-templates')).not.toBeInTheDocument();
  });

  it('returns to main view when Operations is closed', () => {
    render(<Admin />);

    // Open Operations
    const operationsButton = screen.getByTestId('button-operations');
    fireEvent.click(operationsButton);

    expect(screen.getByTestId('operations-component')).toBeInTheDocument();

    // Close Operations
    const closeButton = screen.getByText('Close Operations');
    fireEvent.click(closeButton);

    // Should show main buttons again
    expect(screen.getByTestId('button-operations')).toBeInTheDocument();
    expect(screen.getByTestId('button-templates')).toBeInTheDocument();
    expect(screen.queryByTestId('operations-component')).not.toBeInTheDocument();
  });

  it('returns to main view when Templates is closed', () => {
    render(<Admin />);

    // Open Templates
    const templatesButton = screen.getByTestId('button-templates');
    fireEvent.click(templatesButton);

    expect(screen.getByTestId('templates-component')).toBeInTheDocument();

    // Close Templates
    const closeButton = screen.getByText('Close Templates');
    fireEvent.click(closeButton);

    // Should show main buttons again
    expect(screen.getByTestId('button-operations')).toBeInTheDocument();
    expect(screen.getByTestId('button-templates')).toBeInTheDocument();
    expect(screen.queryByTestId('templates-component')).not.toBeInTheDocument();
  });

  it('does not show Templates when Operations is open', () => {
    render(<Admin />);

    const operationsButton = screen.getByTestId('button-operations');
    fireEvent.click(operationsButton);

    expect(screen.getByTestId('operations-component')).toBeInTheDocument();
    expect(screen.queryByTestId('templates-component')).not.toBeInTheDocument();
  });

  it('does not show Operations when Templates is open', () => {
    render(<Admin />);

    const templatesButton = screen.getByTestId('button-templates');
    fireEvent.click(templatesButton);

    expect(screen.getByTestId('templates-component')).toBeInTheDocument();
    expect(screen.queryByTestId('operations-component')).not.toBeInTheDocument();
  });

  it('maintains state when switching between views', () => {
    render(<Admin />);

    // Open Operations
    const operationsButton = screen.getByTestId('button-operations');
    fireEvent.click(operationsButton);
    expect(screen.getByTestId('operations-component')).toBeInTheDocument();

    // Close Operations
    fireEvent.click(screen.getByText('Close Operations'));
    expect(screen.queryByTestId('operations-component')).not.toBeInTheDocument();

    // Open Templates
    const templatesButton = screen.getByTestId('button-templates');
    fireEvent.click(templatesButton);
    expect(screen.getByTestId('templates-component')).toBeInTheDocument();

    // Close Templates
    fireEvent.click(screen.getByText('Close Templates'));
    expect(screen.queryByTestId('templates-component')).not.toBeInTheDocument();

    // Both buttons should be visible again
    expect(screen.getByTestId('button-operations')).toBeInTheDocument();
    expect(screen.getByTestId('button-templates')).toBeInTheDocument();
  });

  it('renders warning with correct styling', () => {
    render(<Admin />);

    const warning = screen.getByText(
      'Warning: These admin functions are advanced and experimental, proceed with caution.'
    );
    expect(warning).toHaveStyle({ color: 'rgb(255, 165, 0)' });
  });

  it('renders main buttons in a horizontal stack', () => {
    render(<Admin />);

    const button = screen.getByTestId('button-operations');
    const buttonStack = button.closest('[data-testid="stack"]');

    expect(buttonStack).toHaveAttribute('data-horizontal', 'true');
  });
});
