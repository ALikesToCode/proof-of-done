import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { DEFAULT_WINDOW } from '../core/meter';
import type { ProjectView } from '../services/project-view';
import { messageOf, projectApi } from './api';
import { SettingsForm } from './components/project/SettingsForm';
import { page } from './components/styles';

/** The same settings as on the project page, where project admins expect to find them. */
const App = () => {
  const [view, setView] = useState<ProjectView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    projectApi.getProject(DEFAULT_WINDOW).then(setView, (error: unknown) => setProblem(messageOf(error)));
  }, []);

  if (!view) {
    return (
      <Box xcss={page}>
        {problem ? (
          <SectionMessage appearance="error" title="Proof of Done could not load">
            <Text>{problem}</Text>
          </SectionMessage>
        ) : (
          <Spinner label="Loading the settings" />
        )}
      </Box>
    );
  }

  return (
    <Box xcss={page}>
      <Stack space="space.300">
        <Text>
          The rules of proof for {view.project.name}. The meter and the work under contract are on the project's Proof of Done page.
        </Text>
        <SettingsForm view={view} onSaved={(settings) => setView((current) => (current ? { ...current, settings } : current))} />
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
