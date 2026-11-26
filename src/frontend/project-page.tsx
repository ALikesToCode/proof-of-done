import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  SectionMessage,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  useProductContext,
} from '@forge/react';
import { DEFAULT_WINDOW } from '../core/meter';
import type { ProjectView } from '../services/project-view';
import { messageOf, projectApi } from './api';
import { GuideCard } from './components/project/GuideCard';
import { MeterCard } from './components/project/MeterCard';
import { SampleCard } from './components/project/SampleCard';
import { SettingsForm } from './components/project/SettingsForm';
import { WorkTable } from './components/project/WorkTable';
import { page, tabBody } from './components/styles';

const App = () => {
  const context = useProductContext();
  const [view, setView] = useState<ProjectView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [days, setDays] = useState<number>(DEFAULT_WINDOW);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (windowDays: number) => {
    setBusy(true);
    try {
      setView(await projectApi.getProject(windowDays));
      setProblem(null);
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  if (!view) {
    return (
      <Box xcss={page}>
        {problem ? (
          <SectionMessage appearance="error" title="Proof of Done could not load">
            <Text>{problem}</Text>
          </SectionMessage>
        ) : (
          <Spinner label="Loading the project" />
        )}
      </Box>
    );
  }

  const siteUrl = typeof context?.siteUrl === 'string' ? context.siteUrl : null;
  return (
    <Box xcss={page}>
      <Stack space="space.300">
        <Text>
          Done means proven. This page shows what in {view.project.name} needs someone now, and which work items still lack proof.
        </Text>
        {problem && (
          <SectionMessage appearance="error">
            <Text>{problem}</Text>
          </SectionMessage>
        )}
        {view.canAdmin && <GuideCard siteUrl={siteUrl} onChanged={() => load(days)} />}
        <MeterCard meter={view.meter} view={view} busy={busy} onWindow={setDays} />
        <SampleCard view={view} onChanged={() => load(days)} />
        <Tabs id="proof-of-done-project">
          <TabList>
            <Tab>Work under contract</Tab>
            <Tab>Settings</Tab>
          </TabList>
          <TabPanel>
            <Box xcss={tabBody}>
              <Stack space="space.150">
                <WorkTable view={view} siteUrl={siteUrl} />
              </Stack>
            </Box>
          </TabPanel>
          <TabPanel>
            <Box xcss={tabBody}>
              <SettingsForm view={view} onSaved={(settings) => setView((current) => (current ? { ...current, settings } : current))} />
            </Box>
          </TabPanel>
        </Tabs>
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
