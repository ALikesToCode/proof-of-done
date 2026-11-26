import React, { useState } from 'react';
import { Box, Button, Heading, Inline, LoadingButton, Stack, Text, User } from '@forge/react';
import type { ContractView } from '../../services/view';
import { api, messageOf } from '../api';
import { briefNote, timeAgo } from '../text';
import { card } from './styles';

interface Props {
  view: ContractView;
  now: number;
  /** Whether the panel can open Rovo chat for this viewer. */
  canAsk: boolean;
  /** True once the chat has been opened, while the panel looks for the brief. */
  asked: boolean;
  onAsk: () => void;
  onChanged: (view: ContractView) => void;
  onProblem: (message: string) => void;
}

/**
 * What the Proof Verifier told the coding agent to fix, and the way to ask for it.
 * The brief is advice. The verdicts stay with the people who review.
 */
export const RepairBrief = ({ view, now, canAsk, asked, onAsk, onChanged, onProblem }: Props) => {
  const [removing, setRemoving] = useState(false);
  const brief = view.brief;

  const remove = async () => {
    setRemoving(true);
    try {
      onChanged(await api.removeBrief());
    } catch (error) {
      onProblem(messageOf(error));
    } finally {
      setRemoving(false);
    }
  };

  if (!brief) {
    if (!canAsk) return null;
    return (
      <Inline spread="space-between" alignBlock="center" space="space.100">
        <Text size="small" color="color.text.subtle">
          {asked
            ? 'The Proof Verifier is explaining this in Rovo chat. Its repair brief shows up here.'
            : 'The Proof Verifier can explain what blocks this and write a repair brief for the coding agent.'}
        </Text>
        <Button spacing="compact" onClick={onAsk}>
          Ask why it is blocked
        </Button>
      </Inline>
    );
  }

  return (
    <Box xcss={card}>
      <Stack space="space.100">
        <Inline spread="space-between" alignBlock="center">
          <Heading size="xsmall" as="h3">
            Repair brief for the coding agent
          </Heading>
          <Inline space="space.050">
            {canAsk && (
              <Button appearance="subtle" spacing="compact" onClick={onAsk}>
                Ask again
              </Button>
            )}
            {view.canEdit && (
              <LoadingButton appearance="subtle" spacing="compact" isLoading={removing} onClick={remove}>
                Remove brief
              </LoadingButton>
            )}
          </Inline>
        </Inline>
        {brief.text
          .split('\n')
          .filter((line) => line.trim())
          .map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        <Inline space="space.050" alignBlock="center" shouldWrap>
          <Text size="small" color="color.text.subtle">
            Written by the Proof Verifier {timeAgo(brief.at, now)}
            {brief.askedBy ? ', asked by' : '.'}
          </Text>
          {brief.askedBy && <User accountId={brief.askedBy} />}
        </Inline>
        <Text size="small" color="color.text.subtle">
          {briefNote(brief, view.commit)}
        </Text>
      </Stack>
    </Box>
  );
};
