import React, { useState } from 'react';
import { Box, Button, Inline, Link, Lozenge, Stack, Text, User } from '@forge/react';
import type { CriterionView, EvidenceView } from '../../services/view';
import { KIND, REQUIRED, STANDING, channelLine, criterionBadge, detailLines, sourceLine, timeAgo } from '../text';
import { card, evidenceBox } from './styles';

const SHOWN_AT_FIRST = 2;

interface EvidenceProps {
  evidence: EvidenceView;
  now: number;
  onReview: () => void;
}

const EvidenceItem = ({ evidence, now, onReview }: EvidenceProps) => {
  const standing = STANDING[evidence.standing];
  const failed = evidence.checks.filter((check) => !check.ok);
  const verdict = evidence.verdict;
  return (
    <Box xcss={evidenceBox}>
      <Stack space="space.050">
        <Inline space="space.100" alignBlock="center" shouldWrap>
          <Lozenge appearance={standing.tone}>{standing.label}</Lozenge>
          <Text weight="medium">{KIND[evidence.kind]}</Text>
          <Text size="small" color="color.text.subtlest">
            {channelLine(evidence)}, {timeAgo(evidence.createdAt, now)}
          </Text>
          {evidence.actorAccountId && <User accountId={evidence.actorAccountId} />}
        </Inline>
        <Text>{evidence.summary}</Text>
        {evidence.url && (
          <Text size="small">
            <Link href={evidence.url} openNewTab>
              {evidence.url}
            </Link>
          </Text>
        )}
        {detailLines(evidence.details).map((line) => (
          <Text key={line} size="small" color="color.text.subtle">
            {line}
          </Text>
        ))}
        {failed.map((check) => (
          <Text key={check.id} size="small" color="color.text.danger">
            {check.note}
          </Text>
        ))}
        {verdict && verdict.channel !== 'attestation' && (
          <Inline space="space.050" alignBlock="center" shouldWrap>
            <Text size="small" color="color.text.subtle">
              {verdict.decision === 'accepted' ? 'Accepted' : 'Rejected'}
              {verdict.channel === 'verifier' ? ' by the Proof Verifier, asked by' : verdict.channel === 'sample' ? ' in the sample data' : ' by'}
            </Text>
            {verdict.actorAccountId && <User accountId={verdict.actorAccountId} />}
            <Text size="small" color="color.text.subtle">
              {timeAgo(verdict.createdAt, now)}
              {verdict.reason && verdict.reason !== 'Accepted.' ? `. ${verdict.reason}` : ''}
            </Text>
          </Inline>
        )}
        {verdict && verdict.channel === 'attestation' && (
          <Text size="small" color="color.text.subtle">
            {verdict.reason}
          </Text>
        )}
        {evidence.acceptBlocked && (
          <Text size="small" color="color.text.subtle">
            {evidence.acceptBlocked}
          </Text>
        )}
        {(evidence.canAccept || evidence.canReject) && (
          <Inline>
            <Button spacing="compact" appearance={evidence.canAccept ? 'primary' : 'default'} onClick={onReview}>
              {evidence.canAccept ? 'Review' : 'Reject'}
            </Button>
          </Inline>
        )}
      </Stack>
    </Box>
  );
};

interface Props {
  criterion: CriterionView;
  canEdit: boolean;
  now: number;
  onAddEvidence: () => void;
  onEdit: () => void;
  onReview: (evidence: EvidenceView) => void;
}

/** One criterion with its state and the evidence given for it. */
export const Criterion = ({ criterion, canEdit, now, onAddEvidence, onEdit, onReview }: Props) => {
  const [showAll, setShowAll] = useState(false);
  const badge = criterionBadge(criterion);
  const evidence = showAll ? criterion.evidence : criterion.evidence.slice(0, SHOWN_AT_FIRST);
  const hidden = criterion.evidence.length - evidence.length;
  return (
    <Box xcss={card}>
      <Stack space="space.100">
        <Inline spread="space-between" alignBlock="start" space="space.100">
          <Stack space="space.050">
            <Text weight="medium">{criterion.text}</Text>
            <Inline space="space.100" alignBlock="center" shouldWrap>
              <Lozenge appearance={badge.tone}>{badge.label}</Lozenge>
              {criterion.requiredKind !== 'any' && <Lozenge appearance="new">Needs {REQUIRED[criterion.requiredKind].toLowerCase()}</Lozenge>}
              <Text size="small" color="color.text.subtlest">
                {sourceLine(criterion.source, criterion.sourceRef)}
              </Text>
            </Inline>
          </Stack>
          {canEdit && (
            <Inline space="space.050">
              <Button spacing="compact" onClick={onAddEvidence}>
                Add evidence
              </Button>
              <Button spacing="compact" appearance="subtle" onClick={onEdit}>
                Edit
              </Button>
            </Inline>
          )}
        </Inline>
        {evidence.map((item) => (
          <EvidenceItem key={item.id} evidence={item} now={now} onReview={() => onReview(item)} />
        ))}
        {(hidden > 0 || showAll) && criterion.evidence.length > SHOWN_AT_FIRST && (
          <Inline>
            <Button spacing="compact" appearance="subtle" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show less' : `Show ${hidden} older`}
            </Button>
          </Inline>
        )}
      </Stack>
    </Box>
  );
};
