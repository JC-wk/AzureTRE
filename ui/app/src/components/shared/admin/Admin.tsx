import React, { useState } from 'react';
import { Stack, DefaultButton } from '@fluentui/react';
import Operations from './Operations';
import Templates from './Templates';

const Admin: React.FC = () => {
  const [showOperations, setShowOperations] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <Stack className="tre-panel">
      <h1>Admin</h1>
      <p style={{ color: 'Orange' }}>Warning: These admin functions are advanced and experimental, proceed with caution.</p>

      {!showOperations && !showTemplates && (
        <Stack horizontal tokens={{ childrenGap: 12 }} styles={{ root: { marginTop: 10 } }}>
          {/* Future admin actions should be added here as buttons */}
          <DefaultButton text="Operations" onClick={() => setShowOperations(true)} />
          <DefaultButton text="Templates" onClick={() => setShowTemplates(true)} />
          {/* Example placeholder for future admin functions */}
          <DefaultButton text="(coming soon) Other admin action" disabled />
        </Stack>
      )}

      {showOperations && <Operations onClose={() => setShowOperations(false)} />}
      {showTemplates && <Templates onClose={() => setShowTemplates(false)} />}
    </Stack>
  );
};

export default Admin;
