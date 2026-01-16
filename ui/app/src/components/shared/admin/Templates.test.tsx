import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../../../test-utils';
import { Workspace } from '../../../models/workspace';
import { ResourceType } from '../../../models/resourceType';
import { ResultType } from '../../../hooks/useAuthApiCall';

// Mock the API hook
const mockApiCall = vi.fn();
vi.mock('../../../hooks/useAuthApiCall', () => ({
  useAuthApiCall: () => mockApiCall,
  HttpMethod: {
    Get: 'GET',
    Post: 'POST',
    Patch: 'PATCH',
    Delete: 'DELETE',
  },
  ResultType: {
    JSON: 'JSON',
    Text: 'Text',
    None: 'None',
  },
}));

// Mock FluentUI components
vi.mock('@fluentui/react', async () => {
  const actual = await vi.importActual('@fluentui/react');
  return {
    ...actual,
    Stack: ({ children, horizontal, horizontalAlign, verticalAlign, style, className }: any) => (
      <div
        data-testid="stack"
        data-horizontal={horizontal}
        data-horizontal-align={horizontalAlign}
        data-vertical-align={verticalAlign}
        style={style}
        className={className}
      >
        {children}
      </div>
    ),
    DefaultButton: ({ text, onClick }: any) => (
      <button data-testid="default-button" onClick={onClick}>
        {text}
      </button>
    ),
    PrimaryButton: ({ text, onClick, styles, disabled, ...rest }: any) => (
      <button
        data-testid={rest['data-testid'] || "primary-button"}
        onClick={onClick}
        style={styles?.root}
        disabled={disabled}
      >
        {text}
      </button>
    ),
    Spinner: ({ label }: any) => <div>{label}</div>,
  };
});

// Import component after mocks
import Templates from './Templates';

const mockWorkspaceTemplates = [
  {
    id: 'template-1-id',
    name: 'tre-workspace-base',
    title: 'Base Workspace',
    description: 'A base workspace template',
    version: '0.1.0',
    resourceType: ResourceType.Workspace,
    current: true,
  },
  {
    id: 'template-2-id',
    name: 'tre-workspace-base',
    title: 'Base Workspace',
    description: 'A base workspace template',
    version: '0.2.0',
    resourceType: ResourceType.Workspace,
    current: false,
  },
];

const mockWorkspaceServiceTemplates = [
  {
    id: 'template-3-id',
    name: 'tre-service-guacamole',
    title: 'Apache Guacamole',
    description: 'Remote desktop service',
    version: '1.0.0',
    resourceType: ResourceType.WorkspaceService,
    current: true,
  },
];

const mockWorkspaces: { workspaces: Workspace[] } = {
  workspaces: [
    {
      id: 'workspace-1',
      templateName: 'tre-workspace-base',
      templateVersion: '0.1.0',
      resourceType: ResourceType.Workspace,
      deploymentStatus: 'deployed',
      isEnabled: true,
      resourcePath: 'path',
      resourceVersion: 1,
      updatedWhen: 1,
      availableUpgrades: [],
      user: {
        name: 'test',
        email: 'test',
        id: 'user-id',
        roleAssignments: [],
        roles: []
      },
      history: [],
      _etag: 'etag',
      properties: {},
      workspaceURL: 'url'
    }
  ]
};

const mockSharedServices = { sharedServices: [] };

describe('Templates Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.confirm mock
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    mockApiCall.mockImplementation((url: string) => {
      if (url === 'templates') {
        return Promise.resolve([...mockWorkspaceTemplates, ...mockWorkspaceServiceTemplates]);
      }
      if (url === 'workspaces') {
        return Promise.resolve(mockWorkspaces);
      }
      if (url === 'shared-services') {
        return Promise.resolve(mockSharedServices);
      }
      return Promise.resolve({});
    });
  });

  it('renders component with title and close button', () => {
    render(<Templates onClose={mockOnClose} />);
    expect(screen.getByText('Template Management')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('displays warning message about permanent deletion', () => {
    render(<Templates onClose={mockOnClose} />);
    expect(
      screen.getByText(/Warning: Deleting templates is permanent and cannot be undone/)
    ).toBeInTheDocument();
  });

  it('calls API to fetch templates and workspaces on mount', async () => {
    render(<Templates onClose={mockOnClose} />);

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith('templates', 'GET');
      expect(mockApiCall).toHaveBeenCalledWith('workspaces', 'GET');
    });
  });

  it('displays loading state while fetching', () => {
    mockApiCall.mockImplementation(() => new Promise(() => { }));
    render(<Templates onClose={mockOnClose} />);
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
  });

  it('displays "No templates found" when API returns empty array for templates', async () => {
    mockApiCall.mockImplementation((url: string) => {
      if (url === 'templates') {
        return Promise.resolve([]);
      }
      if (url === 'workspaces') {
        return Promise.resolve({ workspaces: [] });
      }
      if (url === 'shared-services') {
        return Promise.resolve({ sharedServices: [] });
      }
      return Promise.resolve({});
    });

    render(<Templates onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No templates found.')).toBeInTheDocument();
    });
  });

  it('renders templates grouped by name and resource type', async () => {
    render(<Templates onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText('Base Workspace')).toBeInTheDocument();
      expect(screen.getByText('Apache Guacamole')).toBeInTheDocument();
    });
  });

  it('displays "In Use" badge for templates that are in use', async () => {
    render(<Templates onClose={mockOnClose} />);
    await waitFor(() => {
      const baseWorkspaceTitle = screen.getByText('Base Workspace');
      // The badge is a span inside the h3
      const inUseBadge = baseWorkspaceTitle.querySelector('span');
      expect(inUseBadge).toBeInTheDocument();
      expect(inUseBadge).toHaveTextContent('In Use');
    });
  });

  it('does not display "In Use" badge for templates that are not in use', async () => {
    render(<Templates onClose={mockOnClose} />);
    await waitFor(() => {
      const guacamoleTitle = screen.getByText('Apache Guacamole');
      const inUseBadge = guacamoleTitle.querySelector('span');
      expect(inUseBadge).not.toBeInTheDocument();
    });
  });

  it('disables "Delete All" button for in-use templates', async () => {
    render(<Templates onClose={mockOnClose} />);
    await waitFor(() => {
      const inUseDeleteButton = screen.getByTestId('delete-all-tre-workspace-base');
      const notInUseDeleteButton = screen.getByTestId('delete-all-tre-service-guacamole');
      expect(inUseDeleteButton).toBeDisabled();
      expect(notInUseDeleteButton).not.toBeDisabled();
    });
  });



  it('displays "In Use" badge next to the specific version that is in use', async () => {
    render(<Templates onClose={mockOnClose} />);
    await waitFor(() => {
      // 0.1.0 is in use
      const versionCell = screen.getByText('0.1.0').closest('td');
      expect(versionCell).toHaveTextContent('In Use');
      
      // 0.2.0 is NOT in use
      const versionCell2 = screen.getByText('0.2.0').closest('td');
      expect(versionCell2).not.toHaveTextContent('In Use');
    });
  });

  it('prompts with a warning when deleting a single version of an in-use template', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<Templates onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText('0.1.0')).toBeInTheDocument();
    });

    // 0.2.0 is first (descending), 0.1.0 is second. 0.1.0 is in use.
    const deleteButtons = screen.getAllByText('Delete Version');
    fireEvent.click(deleteButtons[1]); // Click 0.1.0

    expect(confirmSpy).toHaveBeenCalledWith(
      'This specific version is in use by at least one workspace. Deleting it could cause issues.\n\nAre you sure you want to delete version 0.1.0 of tre-workspace-base?'
    );
    confirmSpy.mockRestore();
  });

  it('does not prompt with a warning when deleting an unused version of an otherwise used template', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<Templates onClose={mockOnClose} />);
    await waitFor(() => {
      expect(screen.getByText('0.2.0')).toBeInTheDocument();
    });

    // 0.2.0 is first. It is NOT in use (0.1.0 is).
    const deleteButtons = screen.getAllByText('Delete Version');
    fireEvent.click(deleteButtons[0]); // Click 0.2.0

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete version 0.2.0 of tre-workspace-base?'
    );
    confirmSpy.mockRestore();
  });

  it('calls API to delete single version when confirmed', async () => {
    mockApiCall.mockImplementation((url: string, method: string) => {
      if (method === 'GET') {
          if (url === 'templates') return Promise.resolve([...mockWorkspaceTemplates, ...mockWorkspaceServiceTemplates]);
          if (url === 'workspaces') return Promise.resolve(mockWorkspaces);
          if (url === 'shared-services') return Promise.resolve(mockSharedServices);
      }
      if (url === '/templates/template-2-id' && method === 'DELETE') return Promise.resolve({});
      return Promise.reject(new Error(`Unexpected API call: ${method} ${url}`));
    });

    render(<Templates onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('0.1.0')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete Version');

    await act(async () => {
      fireEvent.click(deleteButtons[0]); // Clicks the first "Delete Version" button
    });

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith('/templates/template-2-id', 'DELETE', undefined, undefined, ResultType.None);
    });
  });

  it('calls API to delete all versions when confirmed for a non-in-use template', async () => {
    mockApiCall.mockImplementation((url: string, method: string) => {
        if (method === 'GET') {
            if (url === 'templates') return Promise.resolve([...mockWorkspaceTemplates, ...mockWorkspaceServiceTemplates]);
            if (url === 'workspaces') return Promise.resolve(mockWorkspaces);
            if (url === 'shared-services') return Promise.resolve(mockSharedServices);
        }
      if (url === `/templates/${ResourceType.WorkspaceService}/tre-service-guacamole` && method === 'DELETE') return Promise.resolve({});
      return Promise.reject(new Error(`Unexpected API call: ${method} ${url}`));
    });

    render(<Templates onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-all-tre-service-guacamole')).toBeInTheDocument();
    });

    const notInUseButton = screen.getByTestId('delete-all-tre-service-guacamole');

    await act(async () => {
      fireEvent.click(notInUseButton!);
    });

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith(
        `/templates/${ResourceType.WorkspaceService}/tre-service-guacamole`,
        'DELETE',
        undefined,
        undefined,
        ResultType.None
      );
    });
  });


  it('handles API error on initial fetch', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockApiCall.mockRejectedValue(new Error('Fetch failed'));

    render(<Templates onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No templates found.')).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching templates or workspaces', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});