import React, { useState } from 'react';
import {
  Button,
  HelperMessage,
  Label,
  LoadingButton,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  SectionMessage,
  Select,
  Stack,
  Text,
  TextArea,
} from '@forge/react';
import type { RequiredKind } from '../../core/types';
import type { ContractView, CriterionView } from '../../services/view';
import { api, messageOf } from '../api';
import { KIND_OPTIONS } from './AddCriterion';

interface Props {
  criterion: CriterionView;
  onClose: () => void;
  onSaved: (view: ContractView) => void;
}

/** Changes or removes one criterion. A change retires the old version with its evidence. */
export const CriterionModal = ({ criterion, onClose, onSaved }: Props) => {
  const [text, setText] = useState(criterion.text);
  const [kind, setKind] = useState<RequiredKind>(criterion.requiredKind);
  const [saving, setSaving] = useState<'save' | 'remove' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const hasEvidence = criterion.evidence.length > 0;

  const run = async (action: 'save' | 'remove') => {
    setSaving(action);
    setProblem(null);
    try {
      onSaved(action === 'save' ? await api.replaceCriterion(criterion.id, text, kind) : await api.removeCriterion(criterion.id));
    } catch (error) {
      setProblem(messageOf(error));
      setSaving(null);
    }
  };

  return (
    <ModalTransition>
      <Modal onClose={onClose}>
        <ModalHeader>
          <ModalTitle>Edit criterion</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Stack space="space.150">
            <Stack space="space.050">
              <Label labelFor="criterion-text">Criterion</Label>
              <TextArea
                id="criterion-text"
                name="text"
                defaultValue={criterion.text}
                maxLength={500}
                onChange={(event) => setText(String(event.target.value ?? ''))}
              />
            </Stack>
            <Stack space="space.050">
              <Label labelFor="criterion-required">Evidence it needs</Label>
              <Select
                inputId="criterion-required"
                options={KIND_OPTIONS}
                value={KIND_OPTIONS.find((option) => option.value === kind)}
                onChange={(option: { value: RequiredKind } | null) => setKind(option?.value ?? 'any')}
              />
              <HelperMessage>Pick a kind to turn away anything else. A criterion about tests can then only be proven by a test run.</HelperMessage>
            </Stack>
            {hasEvidence && (
              <SectionMessage appearance="warning">
                <Text>
                  This criterion has evidence. Changing or removing it retires that evidence, and the new wording starts unproven.
                  The history keeps both.
                </Text>
              </SectionMessage>
            )}
            {problem && (
              <SectionMessage appearance="error">
                <Text>{problem}</Text>
              </SectionMessage>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <LoadingButton appearance="danger" isLoading={saving === 'remove'} isDisabled={saving !== null} onClick={() => run('remove')}>
            Remove
          </LoadingButton>
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton appearance="primary" isLoading={saving === 'save'} isDisabled={saving !== null} onClick={() => run('save')}>
            Save
          </LoadingButton>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
};
