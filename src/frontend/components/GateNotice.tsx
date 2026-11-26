import React, { useState } from 'react';
import {
  Button,
  HelperMessage,
  Inline,
  Label,
  LoadingButton,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  SectionMessage,
  Stack,
  Text,
  TextArea,
} from '@forge/react';
import { PASS_MINUTES } from '../../core/proof';
import type { ContractView } from '../../services/view';
import { api, messageOf } from '../api';
import { passLine, uncheckedLine } from '../text';

interface Props {
  view: ContractView;
  onChanged: (view: ContractView) => void;
}

/**
 * What the done gate did when it could not check, a pass that holds, and the way out
 * for someone who administers the project. Draws nothing when there is none of them.
 */
export const GateNotice = ({ view, onChanged }: Props) => {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const now = Date.now();
  const { pass, unchecked } = view;
  const open = view.issue.statusCategory !== 'done';
  const offer = view.canLetThrough && !pass && open && (!view.gate.pass || unchecked?.refused === true);
  if (!pass && !unchecked && !offer) return null;

  const close = () => {
    setAsking(false);
    setReason('');
    setProblem(null);
  };

  const grant = async () => {
    setSaving(true);
    setProblem(null);
    try {
      onChanged(await api.letThrough(reason));
      close();
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack space="space.100">
      {pass && (
        <SectionMessage appearance="warning" title="Let through the done gate, without proof">
          <Text>{passLine(pass, now)}</Text>
        </SectionMessage>
      )}
      {!pass && unchecked && (
        <SectionMessage
          appearance={unchecked.refused ? 'error' : 'warning'}
          title={unchecked.refused ? 'The validator could not check, and refused' : 'The validator could not check, and let it through'}
        >
          <Text>{uncheckedLine(unchecked, now, view.canLetThrough)}</Text>
        </SectionMessage>
      )}
      {offer && (
        <Inline>
          <Button appearance="subtle" spacing="compact" onClick={() => setAsking(true)}>
            Let it through without proof
          </Button>
        </Inline>
      )}
      {asking && (
        <ModalTransition>
          <Modal onClose={close}>
            <ModalHeader>
              <ModalTitle>Let {view.issue.key} through the done gate</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <Stack space="space.150">
                <Text>
                  For the next {PASS_MINUTES} minutes the done gate does not hold {view.issue.key}: the validator allows its transition,
                  and the app does not move it back. This proves nothing. The work item goes on counting as not proven.
                </Text>
                <Stack space="space.050">
                  <Label labelFor="pass-reason">Why</Label>
                  <TextArea id="pass-reason" name="reason" maxLength={500} onChange={(event) => setReason(String(event.target.value ?? ''))} />
                  <HelperMessage>Your name, the time and this reason go into the history and into a comment on the work item.</HelperMessage>
                </Stack>
                {problem && (
                  <SectionMessage appearance="error">
                    <Text>{problem}</Text>
                  </SectionMessage>
                )}
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={close}>
                Cancel
              </Button>
              <LoadingButton appearance="warning" isLoading={saving} onClick={grant}>
                Let it through
              </LoadingButton>
            </ModalFooter>
          </Modal>
        </ModalTransition>
      )}
    </Stack>
  );
};
