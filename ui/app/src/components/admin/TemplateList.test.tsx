import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateList } from './TemplateList';
import { useAuthApiCall } from '../../hooks/useAuthApiCall';

vi.mock('../../hooks/useAuthApiCall');

const mockUseAuthApiCall = useAuthApiCall as jest.Mock;

const mockTemplates = [
  { name: 'template1', version: '1.0', description: 'description1', resourceType: 'workspace' },
  { name: 'template2', version: '1.0', description: 'description2', resourceType: 'workspace-service' },
  { name: 'template3', version: '1.0', description: 'description3', resourceType: 'shared-service' },
  { name: 'template4', version: '1.0', description: 'description4', resourceType: 'user-resource', parentWorkspaceService: 'parent_service' },
];

describe('TemplateList component', () => {
  beforeEach(() => {
    mockUseAuthApiCall.mockReturnValue(async () => ({ templates: mockTemplates }));
  });

  it('should render the component', async () => {
    render(<TemplateList />);

    expect(await screen.findByText('template1')).toBeInTheDocument();
    expect(screen.getByText('template2')).toBeInTheDocument();
    expect(screen.getByText('template3')).toBeInTheDocument();
    expect(screen.getByText('template4')).toBeInTheDocument();
  });

  it('should open the delete dialog when the delete button is clicked', async () => {
    render(<TemplateList />);

    const deleteButtons = await screen.findAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(await screen.findByText('Delete Template')).toBeInTheDocument();
  });
});
