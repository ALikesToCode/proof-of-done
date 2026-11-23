import React, { useState } from 'react';
import { Box, ErrorMessage, Inline, LoadingButton, Select, Stack, Textfield } from '@forge/react';
import { REQUIRED_KINDS, RequiredKind } from '../../core/types';
import type { ContractView } from '../../services/view';
import { api, messageOf } from '../api';
import { REQUIRED } from '../text';
import { grow, kindSelect } from './styles';

export const KIND_OPTIONS = REQUIRED_KINDS.map((kind) => ({ label: kind === 'any' ? 'Any evidence' : `Needs ${REQUIRED[kind].toLowerCase()}`, value: kind }));

interface Props {
  onChanged: (view: ContractView) => void;
}

/** One line to add a criterion by hand. */
export const AddCriterion = ({ onChanged }: Props) => {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<RequiredKind>('any');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The field is uncontrolled so typing never waits on a round trip. Changing the key clears it.
  const [round, setRound] = useState(0);

  const add = async () => {
    if (text.trim().length < 3) {
      setProblem('Write the criterion first (at least 3 characters).');
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      onChanged(await api.addCriterion(text, kind));
      setText('');
      setKind('any');
      setRound((n) => n + 1);
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack space="space.050">
      <Inline space="space.100" alignBlock="center">
        <Box xcss={grow}>
          <Textfield
            key={`criterion-${round}`}
            name="criterion"
            placeholder="Add a criterion, for example: Login works with a passkey"
            maxLength={500}
            onChange={(event) => setText(String(event.target.value ?? ''))}
          />
        </Box>
        <Box xcss={kindSelect}>
          <Select
            inputId="criterion-kind"
            options={KIND_OPTIONS}
            value={KIND_OPTIONS.find((option) => option.value === kind)}
            onChange={(option: { value: RequiredKind } | null) => setKind(option?.value ?? 'any')}
          />
        </Box>
        <LoadingButton isLoading={saving} onClick={add}>
          Add
        </LoadingButton>
      </Inline>
      {problem && <ErrorMessage>{problem}</ErrorMessage>}
    </Stack>
  );
};
