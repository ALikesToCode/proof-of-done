import React, { useState } from 'react';
import { Button, Inline, List, ListItem, LoadingButton, SectionMessage, Stack, Text } from '@forge/react';
import type { ContractView } from '../../services/view';
import { api, messageOf } from '../api';
import { sourceLine } from '../text';
import { AddCriterion } from './AddCriterion';
import { GateNotice } from './GateNotice';

interface Props {
  view: ContractView;
  onChanged: (view: ContractView) => void;
}

/** Shown on a work item that has no contract yet. */
export const NoContract = ({ view, onChanged }: Props) => {
  const [creating, setCreating] = useState<'filled' | 'empty' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const count = view.suggestions.length;

  const create = async (withSuggestions: boolean) => {
    setCreating(withSuggestions ? 'filled' : 'empty');
    setProblem(null);
    try {
      onChanged(await api.createContract(withSuggestions));
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setCreating(null);
    }
  };

  return (
    <Stack space="space.150">
      <Text>
        A done contract lists what has to be true before {view.issue.key} can close, and keeps the proof for each point. This work
        item has none yet.
      </Text>
      <GateNotice view={view} onChanged={onChanged} />
      {count > 0 && (
        <Stack space="space.100">
          <Text weight="medium">
            {count === 1 ? 'One criterion was found for this work item:' : `${count} criteria were found for this work item:`}
          </Text>
          <List type="unordered">
            {view.suggestions.map((suggestion) => (
              <ListItem key={suggestion.text}>
                <Text>{suggestion.text}</Text>
                <Text size="small" color="color.text.subtlest">
                  {sourceLine(suggestion.source, suggestion.sourceRef)}
                </Text>
              </ListItem>
            ))}
          </List>
        </Stack>
      )}
      {problem && (
        <SectionMessage appearance="error">
          <Text>{problem}</Text>
        </SectionMessage>
      )}
      {!view.canEdit && (
        <Text size="small" color="color.text.subtle">
          You need permission to edit this work item to create its contract.
        </Text>
      )}
      {view.canEdit && count > 0 && (
        <Inline space="space.100">
          <LoadingButton appearance="primary" isLoading={creating === 'filled'} isDisabled={creating !== null} onClick={() => create(true)}>
            {count === 1 ? 'Create contract with this criterion' : `Create contract with these ${count} criteria`}
          </LoadingButton>
          <Button appearance="subtle" isDisabled={creating !== null} onClick={() => create(false)}>
            Start empty
          </Button>
        </Inline>
      )}
      {view.canEdit && count === 0 && (
        <Stack space="space.100">
          <Text size="small" color="color.text.subtle">
            No acceptance criteria were found in the description. Write the first one here, or add a list under a heading such as
            "Acceptance criteria" to the description.
          </Text>
          <AddCriterion onChanged={onChanged} />
        </Stack>
      )}
    </Stack>
  );
};
