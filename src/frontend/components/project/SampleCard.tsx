import React, { useState } from 'react';
import { Button, EmptyState, Inline, LoadingButton, ProgressBar, SectionMessage, Stack, Text } from '@forge/react';
import { SAMPLE_LABEL } from '../../../core/sample';
import type { ProjectView } from '../../../services/project-view';
import { messageOf, projectApi } from '../../api';

interface Props {
  view: ProjectView;
  /** Called after sample data was loaded or removed, so the page can read the project again. */
  onChanged: () => Promise<void>;
}

type Work = { kind: 'loading'; step: number; summary: string } | { kind: 'removing' } | null;

/** Loads five sample work items into the project with one click, and removes them again. */
export const SampleCard = ({ view, onChanged }: Props) => {
  const [work, setWork] = useState<Work>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { loaded, size } = view.sample;

  const load = async () => {
    setProblem(null);
    try {
      // One call per work item. Making all five takes longer than a single call may run.
      let last = '';
      for (let index = 0; index < size; index++) {
        setWork({ kind: 'loading', step: index + 1, summary: last });
        last = (await projectApi.loadSample(index)).summary;
      }
    } catch (error) {
      setProblem(messageOf(error));
    }
    await onChanged();
    setWork(null);
  };

  const remove = async () => {
    setProblem(null);
    setConfirming(false);
    setWork({ kind: 'removing' });
    try {
      const result = await projectApi.removeSample();
      if (result.kept.length > 0) {
        setProblem(`Jira would not delete ${result.kept.join(', ')}. Delete ${result.kept.length === 1 ? 'it' : 'them'} in Jira, then remove the sample data again.`);
      }
    } catch (error) {
      setProblem(messageOf(error));
    }
    await onChanged();
    setWork(null);
  };

  const failure = problem && (
    <SectionMessage appearance="error">
      <Text>{problem}</Text>
    </SectionMessage>
  );

  if (work?.kind === 'loading') {
    return (
      <Stack space="space.100">
        <Text>
          Creating sample work item {work.step} of {size}.{work.summary ? ` Made so far: ${work.summary}` : ''}
        </Text>
        <ProgressBar value={(work.step - 1) / size} ariaLabel={`Sample work item ${work.step} of ${size}`} />
      </Stack>
    );
  }

  if (loaded > 0) {
    return (
      <Stack space="space.100">
        <SectionMessage appearance="information" title={loaded < size ? `${loaded} of ${size} sample work items are loaded` : 'Sample data is loaded'}>
          <Stack space="space.100">
            <Text>
              {loaded} work {loaded === 1 ? 'item' : 'items'} in this project {loaded === 1 ? 'is a sample' : 'are samples'}. Their summaries
              start with "Sample:" and they carry the label {SAMPLE_LABEL}. They count in the meter until you remove them.
            </Text>
            {view.canAdmin && !confirming && (
              <Inline space="space.100">
                {loaded < size && (
                  <Button onClick={load} isDisabled={work !== null}>
                    Load the rest
                  </Button>
                )}
                <LoadingButton isLoading={work?.kind === 'removing'} onClick={() => setConfirming(true)}>
                  Remove sample data
                </LoadingButton>
              </Inline>
            )}
            {view.canAdmin && confirming && (
              <Inline space="space.100" alignBlock="center">
                <Text>
                  This deletes the {loaded} sample work {loaded === 1 ? 'item' : 'items'} and their proof. Nothing else is touched.
                </Text>
                <Button appearance="danger" onClick={remove}>
                  Delete them
                </Button>
                <Button appearance="subtle" onClick={() => setConfirming(false)}>
                  Keep them
                </Button>
              </Inline>
            )}
          </Stack>
        </SectionMessage>
        {failure}
      </Stack>
    );
  }

  if (view.contracts.total === 0) {
    return (
      <Stack space="space.100">
        <EmptyState
          header="No done contracts in this project yet"
          description={
            view.canAdmin
              ? 'Open a work item, add the Proof of Done panel from its apps button, and create the contract. Or load five sample work items to see every state of the app at once.'
              : 'Open a work item, add the Proof of Done panel from its apps button, and create the contract. A project admin can also load sample data here.'
          }
          primaryAction={
            view.canAdmin ? (
              <Button appearance="primary" onClick={load}>
                Load sample data
              </Button>
            ) : undefined
          }
        />
        {failure}
      </Stack>
    );
  }

  if (!view.canAdmin) return null;
  return (
    <Stack space="space.100">
      <Inline space="space.100" alignBlock="center">
        <Text size="small" color="color.text.subtle">
          Want to see every state of the app at once?
        </Text>
        <Button appearance="subtle" spacing="compact" onClick={load}>
          Load sample data
        </Button>
      </Inline>
      {failure}
    </Stack>
  );
};
