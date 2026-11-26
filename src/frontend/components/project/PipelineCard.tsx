import React, { useState } from 'react';
import { Box, Button, CodeBlock, ErrorMessage, Inline, LoadingButton, SectionMessage, Stack, Text } from '@forge/react';
import { PipelineView, messageOf, projectApi } from '../../api';
import { pipelineSnippet, pipelineStatusLine } from '../../project-text';
import { card } from '../styles';

/** The project's pipeline key: make it, replace it, remove it, and how a pipeline uses it. */
export const PipelineCard = () => {
  const [view, setView] = useState<PipelineView | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'remove' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // Read when someone asks for it. The settings tab is mounted with the page, and most visits never open this.
  const load = async () => {
    setLoading(true);
    setProblem(null);
    try {
      setView(await projectApi.getPipeline());
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setLoading(false);
    }
  };

  const run = async (what: 'create' | 'remove') => {
    setBusy(what);
    setProblem(null);
    try {
      if (what === 'create') {
        const made = await projectApi.createPipelineKey();
        setKey(made.key);
        setView(made);
      } else {
        setKey(null);
        setView(await projectApi.removePipelineKey());
      }
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(null);
    }
  };

  if (!view) {
    return (
      <Stack space="space.100">
        <Inline>
          <LoadingButton isLoading={loading} onClick={load}>
            Set up the pipeline
          </LoadingButton>
        </Inline>
        {problem && <ErrorMessage>{problem}</ErrorMessage>}
      </Stack>
    );
  }

  return (
    <Box xcss={card}>
      <Stack space="space.150">
        <Text>{pipelineStatusLine(view, Date.now())}</Text>
        <Inline space="space.100">
          <LoadingButton isLoading={busy === 'create'} isDisabled={busy !== null} onClick={() => run('create')}>
            {view.exists ? 'Replace the key' : 'Create a key'}
          </LoadingButton>
          {view.exists && (
            <Button appearance="subtle" isDisabled={busy !== null} onClick={() => run('remove')}>
              Remove the key
            </Button>
          )}
        </Inline>
        {key && (
          <SectionMessage appearance="warning" title="Copy the key now. It is not shown again.">
            <Stack space="space.100">
              <CodeBlock text={key} language="text" />
              <Text>Store it as a secret named PROOF_OF_DONE_KEY in your pipeline. Anyone who has it can report results for this project.</Text>
            </Stack>
          </SectionMessage>
        )}
        {view.exists && (
          <Stack space="space.100">
            <Text>
              Add this step after your tests. It reads the work item key from the branch name, so name the branch after the work item, for
              example ABC-12-export.
            </Text>
            <CodeBlock text={pipelineSnippet(view.url)} language="yaml" />
          </Stack>
        )}
        {problem && <ErrorMessage>{problem}</ErrorMessage>}
      </Stack>
    </Box>
  );
};
