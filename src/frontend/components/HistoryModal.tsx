import React, { useEffect, useState } from 'react';
import {
  Button,
  Inline,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  User,
} from '@forge/react';
import type { HistoryEntry } from '../../services/view';
import { api, messageOf } from '../api';
import { actorLabel, describeEvent, timeAgo } from '../text';

interface Props {
  issueKey: string;
  onClose: () => void;
}

/** Everything that happened to the contract, newest first. Nothing in it can be edited. */
export const HistoryModal = ({ issueKey, onClose }: Props) => {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const now = Date.now();

  useEffect(() => {
    let cancelled = false;
    api.getHistory().then(
      (history) => {
        if (!cancelled) setEntries(history);
      },
      (error) => {
        if (!cancelled) setProblem(messageOf(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ModalTransition>
      <Modal onClose={onClose}>
        <ModalHeader>
          <ModalTitle>Proof history of {issueKey}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {problem && (
            <SectionMessage appearance="error">
              <Text>{problem}</Text>
            </SectionMessage>
          )}
          {!problem && entries === null && <Spinner label="Loading the history" />}
          {entries !== null && entries.length === 0 && <Text>Nothing has happened to this contract yet.</Text>}
          {entries !== null && entries.length > 0 && (
            <Stack space="space.150">
              {entries.map((entry) => (
                <Stack key={entry.id} space="space.025">
                  <Inline space="space.050" alignBlock="center" shouldWrap>
                    {entry.actorAccountId ? <User accountId={entry.actorAccountId} /> : <Text weight="medium">{actorLabel(entry)}</Text>}
                    <Text size="small" color="color.text.subtlest">
                      {entry.channel === 'agent' ? 'through an agent, ' : ''}
                      {timeAgo(entry.at, now)}
                    </Text>
                  </Inline>
                  <Text>{describeEvent(entry)}</Text>
                </Stack>
              ))}
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button appearance="subtle" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
};
