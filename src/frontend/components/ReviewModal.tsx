import React, { useEffect, useState } from 'react';
import {
  Button,
  HelperMessage,
  Label,
  Link,
  LoadingButton,
  Lozenge,
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
  User,
  Inline,
} from '@forge/react';
import { graphCovers } from '../../core/graph';
import type { GraphNote } from '../../core/graph';
import type { ContractView, CriterionView, EvidenceView } from '../../services/view';
import { api, messageOf } from '../api';
import { GRAPH_FINDING, KIND, STANDING, channelLine, detailLines } from '../text';
import { Excerpt } from './Excerpt';
import { Line } from './Line';

interface Props {
  criterion: CriterionView;
  evidence: EvidenceView;
  onClose: () => void;
  onSaved: (view: ContractView) => void;
}

/** Where a person decides whether a piece of evidence proves its criterion. */
export const ReviewModal = ({ criterion, evidence, onClose, onSaved }: Props) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState<'accepted' | 'rejected' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const covered = graphCovers(evidence);
  const [graph, setGraph] = useState<GraphNote | null>(null);
  const [asking, setAsking] = useState(covered);
  const [asks, setAsks] = useState(0);
  const standing = STANDING[evidence.standing];

  // For a pull request or a build, ask what Jira itself links to the work item.
  // The answer is an extra: when the graph is silent the dialog says so and goes on without it.
  useEffect(() => {
    if (!covered) return;
    let open = true;
    setAsking(true);
    api
      .getGraphNote(evidence.id)
      .then((answer) => {
        if (open) setGraph(answer.note);
      })
      .catch(() => undefined)
      .finally(() => {
        if (open) setAsking(false);
      });
    return () => {
      open = false;
    };
  }, [evidence.id, asks]);

  const decide = async (decision: 'accepted' | 'rejected') => {
    if (decision === 'rejected' && reason.trim().length < 3) {
      setProblem('Say why this evidence does not prove the criterion.');
      return;
    }
    setSaving(decision);
    setProblem(null);
    try {
      onSaved(await api.recordVerdict({ evidenceId: evidence.id, decision, reason: reason.trim() || null }));
    } catch (error) {
      setProblem(messageOf(error));
      setSaving(null);
    }
  };

  return (
    <ModalTransition>
      <Modal onClose={onClose}>
        <ModalHeader>
          <ModalTitle>Review evidence</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Stack space="space.150">
            <Stack space="space.050">
              <Line size="small" color="color.text.subtle">
                Criterion
              </Line>
              <Line weight="medium">{criterion.text}</Line>
            </Stack>
            <Stack space="space.050">
              <Inline space="space.100" alignBlock="center" shouldWrap>
                <Line size="small" color="color.text.subtle">
                  Evidence
                </Line>
                <Lozenge appearance={standing.tone}>{standing.label}</Lozenge>
                <Line size="small" color="color.text.subtle">
                  {KIND[evidence.kind]}. {channelLine(evidence)}
                </Line>
                {evidence.actorAccountId && <User accountId={evidence.actorAccountId} />}
              </Inline>
              <Line>{evidence.summary}</Line>
              {evidence.url && (
                <Line>
                  <Link href={evidence.url} openNewTab>
                    {evidence.url}
                  </Link>
                </Line>
              )}
              {detailLines(evidence.details).map((line) => (
                <Line key={line} size="small">
                  {line}
                </Line>
              ))}
              {evidence.details.text && <Excerpt text={evidence.details.text} whole />}
            </Stack>
            <Stack space="space.050">
              <Line size="small" color="color.text.subtle">
                Checks the app ran
              </Line>
              {evidence.checks.map((check) => (
                <Line key={check.id} size="small">
                  {check.note}
                </Line>
              ))}
              <Line size="small" color="color.text.subtlest">
                These only show the evidence is well-formed. Whether it proves the criterion is your call.
              </Line>
            </Stack>
            {covered && (
              <Stack space="space.050">
                <Inline space="space.100" alignBlock="center" shouldWrap>
                  <Line size="small" color="color.text.subtle">
                    Teamwork Graph
                  </Line>
                  {graph && <Lozenge appearance={GRAPH_FINDING[graph.finding].tone}>{GRAPH_FINDING[graph.finding].label}</Lozenge>}
                  {!graph && !asking && (
                    <Button spacing="compact" appearance="subtle" onClick={() => setAsks(asks + 1)}>
                      Ask again
                    </Button>
                  )}
                </Inline>
                <Line size="small">
                  {graph ? graph.text : asking ? 'Asking what Jira links to this work item.' : 'The Teamwork Graph did not answer. You can judge without it, or ask again.'}
                </Line>
              </Stack>
            )}
            <Stack space="space.050">
              <Label labelFor="verdict-reason">Reason</Label>
              <TextArea id="verdict-reason" name="reason" maxLength={2000} onChange={(event) => setReason(String(event.target.value ?? ''))} />
              <HelperMessage>Needed to reject. Worth a line when you accept, so the next reader knows what you checked.</HelperMessage>
            </Stack>
            {evidence.acceptBlocked && (
              <SectionMessage appearance="information">
                <Text>{evidence.acceptBlocked}</Text>
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
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          {evidence.canReject && (
            <LoadingButton appearance="danger" isLoading={saving === 'rejected'} isDisabled={saving !== null} onClick={() => decide('rejected')}>
              Reject
            </LoadingButton>
          )}
          {evidence.canAccept && (
            <LoadingButton appearance="primary" isLoading={saving === 'accepted'} isDisabled={saving !== null} onClick={() => decide('accepted')}>
              Accept
            </LoadingButton>
          )}
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
};
