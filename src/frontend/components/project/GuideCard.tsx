import React, { useEffect, useState } from 'react';
import { Box, Button, Heading, Inline, Link, LoadingButton, Lozenge, SectionMessage, Stack, Text } from '@forge/react';
import type { GuideView } from '../../../services/project-view';
import { messageOf, projectApi } from '../../api';
import { guideAnswer, guideProgress } from '../../project-text';
import { card } from '../styles';

interface Props {
  siteUrl: string | null;
  /** Called after a step ran or the sample was removed, so the page can read the project again. */
  onChanged: () => Promise<void>;
}

/**
 * The guided run: six presses on one sample work item that show a false "done" caught.
 * For someone who administers the project, because it creates a work item.
 */
export const GuideCard = ({ siteUrl, onChanged }: Props) => {
  const [guide, setGuide] = useState<GuideView | null>(null);
  const [busy, setBusy] = useState<'step' | 'remove' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    projectApi.getGuide().then(setGuide, (error: unknown) => setProblem(messageOf(error)));
  }, []);

  const step = async () => {
    if (!guide?.next) return;
    setBusy('step');
    setProblem(null);
    try {
      setGuide(await projectApi.advanceGuide(guide.next.id));
      await onChanged();
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setProblem(null);
    try {
      const result = await projectApi.removeSample();
      if (result.kept.length > 0) setProblem(`Jira would not delete ${result.kept.join(', ')}. Delete it in Jira, then remove the sample again.`);
      setGuide(await projectApi.getGuide());
      await onChanged();
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(null);
    }
  };

  const failure = problem && (
    <SectionMessage appearance="error">
      <Text>{problem}</Text>
    </SectionMessage>
  );
  if (!guide) return failure || null;

  if (guide.lines.length === 0) {
    return (
      <Stack space="space.100">
        <SectionMessage appearance="discovery" title="See a false &quot;done&quot; caught, in one minute">
          <Stack space="space.100">
            <Text>
              A coding agent says the tests pass. The pipeline ran the same commit and says they do not. Press through six steps and
              watch what the done gate answers after each one. It needs no repository, no pipeline and no agent: the app creates one
              sample work item, and every record it adds is labelled as sample data.
            </Text>
            <Inline>
              <LoadingButton appearance="primary" isLoading={busy === 'step'} onClick={step}>
                {guide.next?.label ?? 'Start'}
              </LoadingButton>
            </Inline>
          </Stack>
        </SectionMessage>
        {failure}
      </Stack>
    );
  }

  const last = guide.lines.at(-1);
  return (
    <Box xcss={card}>
      <Stack space="space.150">
        <Inline spread="space-between" alignBlock="center">
          <Heading size="xsmall" as="h3">
            A false "done", caught
          </Heading>
          <Text size="small" color="color.text.subtle">
            {guideProgress(guide)}
          </Text>
        </Inline>
        <Stack space="space.100">
          {guide.lines.map((line, index) => (
            <Stack key={line.id} space="space.025">
              <Text>
                {index + 1}. {line.text}
              </Text>
              <Inline space="space.100" alignBlock="center">
                <Lozenge appearance={line.pass ? 'success' : 'removed'} isBold={index === guide.lines.length - 1}>
                  {line.pass ? 'Can close' : 'Cannot close'}
                </Lozenge>
                <Text size="small" color="color.text.subtle">
                  {guideAnswer(line)}
                </Text>
              </Inline>
            </Stack>
          ))}
        </Stack>
        {guide.next && (
          <Inline space="space.100" alignBlock="center" shouldWrap>
            <LoadingButton appearance="primary" isLoading={busy === 'step'} isDisabled={busy !== null} onClick={step}>
              Next: {guide.next.label}
            </LoadingButton>
            {guide.key && siteUrl && <Link href={`${siteUrl}/browse/${guide.key}`}>Open {guide.key}</Link>}
          </Inline>
        )}
        {!guide.next && last && (
          <SectionMessage appearance="success" title="That is the whole loop">
            <Text>
              The agent's word proved nothing, the pipeline's result turned it away, and proof of one commit did not carry over to the
              next. {guide.key ? `Open ${guide.key} to read each record and its history. ` : ''}For your own work: create the pipeline's key
              under Settings, and add the "Proof of Done is complete" validator to your workflow so Jira refuses the transition itself.
            </Text>
          </SectionMessage>
        )}
        <Inline space="space.100" alignBlock="center">
          {!guide.next && guide.key && siteUrl && <Link href={`${siteUrl}/browse/${guide.key}`}>Open {guide.key}</Link>}
          <LoadingButton appearance="subtle" spacing="compact" isLoading={busy === 'remove'} isDisabled={busy !== null} onClick={remove}>
            Remove the sample
          </LoadingButton>
        </Inline>
        {failure}
      </Stack>
    </Box>
  );
};
