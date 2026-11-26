import React from 'react';
import { Button, Inline, Lozenge, ProgressBar, SectionMessage, Stack, Text } from '@forge/react';
import type { ContractView } from '../../services/view';
import { PROOF_STATE, proofLine, shortCommit } from '../text';

interface Props {
  view: ContractView;
  onHistory: () => void;
  onRefresh: () => void;
}

/** The state of the whole contract and what it means for closing the work item. */
export const Summary = ({ view, onHistory, onRefresh }: Props) => {
  const { summary, gate, policy, issue } = view;
  const badge = PROOF_STATE[summary.state];
  const proven = summary.state === 'proven';
  const closedWithoutProof = !gate.pass && issue.statusCategory === 'done';
  return (
    <Stack space="space.100">
      <Inline spread="space-between" alignBlock="center">
        <Inline space="space.100" alignBlock="center">
          <Lozenge appearance={badge.tone} isBold={proven}>
            {badge.label}
          </Lozenge>
          <Text>{proofLine(summary.proven, summary.total)}</Text>
        </Inline>
        <Inline space="space.050">
          <Button appearance="subtle" spacing="compact" onClick={onRefresh}>
            Refresh
          </Button>
          <Button appearance="subtle" spacing="compact" onClick={onHistory}>
            History
          </Button>
        </Inline>
      </Inline>
      {summary.total > 0 && (
        <ProgressBar
          value={summary.proven / summary.total}
          appearance={proven ? 'success' : 'default'}
          ariaLabel={proofLine(summary.proven, summary.total)}
        />
      )}
      {view.commit && (
        <Text size="small" color="color.text.subtle">
          The pipeline last reported commit {shortCommit(view.commit)}. Proof of an earlier commit does not count.
        </Text>
      )}
      {closedWithoutProof && (
        <SectionMessage appearance="warning" title={`${issue.key} is ${issue.statusName}, but it is not proven`}>
          <Text>{gate.reason}</Text>
        </SectionMessage>
      )}
      {!closedWithoutProof && summary.total > 0 && policy.gateMode !== 'off' && (
        <Text size="small" color={proven ? 'color.text.success' : 'color.text.subtle'}>
          {proven
            ? `${gate.reason}${summary.selfReviewed ? ` ${summary.selfReviewed} self-reviewed.` : ''} This work item can close.`
            : `Not ready to close. ${gate.reason}`}
        </Text>
      )}
    </Stack>
  );
};
