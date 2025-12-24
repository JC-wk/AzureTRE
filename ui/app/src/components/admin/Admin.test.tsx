import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Admin } from './Admin';

// Mock the TemplateList component
vi.mock('./TemplateList', () => {
  return {
    TemplateList: () => {
      return <div>TemplateList</div>;
    },
  };
});

describe('Admin component', () => {
  it('should render the component', () => {
    render(
      <BrowserRouter>
        <Admin />
      </BrowserRouter>
    );

    expect(screen.getByText('Template Management')).toBeInTheDocument();
    expect(screen.getByText('TemplateList')).toBeInTheDocument();
  });
});
