import React from 'react';
import { TemplateList } from "./TemplateList";

export const Admin: React.FunctionComponent = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Template Management</h1>
      <TemplateList />
    </div>
  );
};
