
import { vi } from 'vitest';
import * as useAuthApiCall from '../../../hooks/useAuthApiCall';

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Templates from './Templates';
import { ResourceTemplate } from '../../../models/resourceTemplate';

const mockApiCall = vi.fn();

const mockTemplatesResponse = {
  '/workspace-templates': {
    templates: [
      { id: '1', name: 'template1', title: 'Template 1', description: 'd1', version: '1.0', resourceType: 'workspace', current: true, properties: {}, customActions: [], required: [], uiSchema: {} },
      { id: '2', name: 'template1', title: 'Template 1', description: 'd1', version: '2.0', resourceType: 'workspace', current: false, properties: {}, customActions: [], required: [], uiSchema: {} },
    ] as unknown as ResourceTemplate[],
  },
  '/shared-service-templates': {
    templates: [
      { id: '3', name: 'template2', title: 'Template 2', description: 'd2', version: '1.0', resourceType: 'shared-service', current: true, properties: {}, customActions: [], required: [], uiSchema: {} },
    ] as unknown as ResourceTemplate[],
  },
  '/workspace-service-templates': {
    templates: [
        { id: '4', name: 'template3', title: 'Template 3', description: 'd3', version: '1.0', resourceType: 'workspace-service', current: true, properties: {}, customActions: [], required: [], uiSchema: {} },
    ] as unknown as ResourceTemplate[],
  },
  '/workspace-service-templates/template3/user-resource-templates': {
    templates: [
        { id: '5', name: 'template4', title: 'Template 4', description: 'd4', version: '1.0', resourceType: 'user-resource', current: true, properties: {}, customActions: [], required: [], uiSchema: {}, parentVm: 'template3' },
    ] as unknown as ResourceTemplate[],
  },
};

describe('Templates Component', () => {
  beforeEach(() => {
    vi.spyOn(useAuthApiCall, 'useAuthApiCall').mockReturnValue(mockApiCall);
    mockApiCall.mockImplementation(async (url: string, method: string) => {
      if (method === 'DELETE') {
        return Promise.resolve();
      }
      return Promise.resolve(mockTemplatesResponse[url] || { templates: [] });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders templates and handles deletion', async () => {
    render(<Templates onClose={() => {}} />);
    expect(screen.getByText('Registered Templates')).toBeInTheDocument();

    // Wait for all templates to be rendered
    expect(await screen.findByText('template1')).toBeInTheDocument();
    expect(await screen.findByText('template2')).toBeInTheDocument();
    expect(await screen.findByText('template3')).toBeInTheDocument();
    expect(await screen.findByText('template4')).toBeInTheDocument();

    // There are two "template1" texts, one for each version
    expect(screen.getAllByText('template1').length).toBe(2);

    // Delete a single version of template1
    const deleteButtons = await screen.findAllByText('Delete Version');
    fireEvent.click(deleteButtons[0]);

    // Confirm the deletion
    const confirmButton = await screen.findByText('Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith('/workspace-templates/template1?version=1.0', 'DELETE');
    });

    // The deleted version should be removed from the UI
    await waitFor(() => {
      expect(screen.getAllByText('template1').length).toBe(1);
    });

    // Delete all versions of template2
    const deleteAllButtons = await screen.findAllByText('Delete All');
    fireEvent.click(deleteAllButtons[1]); // Corresponds to template2

    // Confirm the deletion
    const confirmButton2 = await screen.findByText('Delete');
    fireEvent.click(confirmButton2);

    await waitFor(() => {
        expect(mockApiCall).toHaveBeenCalledWith('/shared-service-templates/template2', 'DELETE');
    });

    await waitFor(() => {
        expect(screen.queryByText('template2')).not.toBeInTheDocument();
    });
  });

  test('handles user resource deletion', async () => {
    render(<Templates onClose={() => {}} />);
    expect(await screen.findByText('template4')).toBeInTheDocument();

    const deleteButtons = await screen.findAllByText('Delete Version');
    fireEvent.click(deleteButtons[3]); // Corresponds to template4

    const confirmButton = await screen.findByText('Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith('/workspace-service-templates/template3/user-resource-templates/template4?version=1.0', 'DELETE');
    });
  });
});
