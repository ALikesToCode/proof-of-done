import React, { useState } from 'react';
import { Box, Button, Inline, Link, Lozenge, Stack, Text, User } from '@forge/react';
import type { CriterionView, EvidenceView } from '../../services/view';
import { KIND, REQUIRED, STANDING, channelLine, criterionBadge, detailLines, sourceLine, timeAgo } from '../text';
import { Excerpt } from './Excerpt';
import { Line } from './Line';
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
          <Line weight="medium">{KIND[evidence.kind]}</Line>
          <Line size="small" color="color.text.subtlest">
            {channelLine(evidence)}, {timeAgo(evidence.createdAt, now)}
          </Line>
          {evidence.actorAccountId && <User accountId={evidence.actorAccountId} />}
        </Inline>
        <Line>{evidence.summary}</Line>
        {evidence.url && (
          <Line size="small">
            <Link href={evidence.url} openNewTab>
              {evidence.url}
            </Link>
          </Line>
        )}
        {detailLines(evidence.details, evidence.kind).map((line) => (
          <Line key={line} size="small" color="color.text.subtle">
            {line}
          </Line>
        ))}
        {evidence.details.text && <Excerpt text={evidence.details.text} />}
        {evidence.standing === 'stale' && (
          <Line size="small" color="color.text.subtle">
            The pipeline has reported a newer commit since. This no longer proves the criterion.
          </Line>
        )}
        {failed.map((check) => (
          <Line key={check.id} size="small" color="color.text.danger">
            {check.note}
          </Line>
        ))}
        {verdict && verdict.channel !== 'attestation' && verdict.channel !== 'ci' && verdict.channel !== 'check' && (
          <Inline space="space.050" alignBlock="center" shouldWrap>
            <Line size="small" color="color.text.subtle">
              {verdict.decision === 'accepted' ? 'Accepted' : 'Rejected'}
              {verdict.channel === 'verifier' ? ' by the Proof Verifier, asked by' : verdict.channel === 'sample' ? ' in the sample data' : ' by'}
            </Line>
            {verdict.actorAccountId && <User accountId={verdict.actorAccountId} />}
            <Line size="small" color="color.text.subtle">
              {timeAgo(verdict.createdAt, now)}
              {verdict.reason && verdict.reason !== 'Accepted.' ? `. ${verdict.reason}` : ''}
            </Line>
          </Inline>
        )}
        {verdict && (verdict.channel === 'attestation' || verdict.channel === 'ci' || verdict.channel === 'check') && (
          <Line size="small" color={verdict.channel === 'check' ? 'color.text.danger' : 'color.text.subtle'}>
            {verdict.channel === 'check' ? `Turned away by the app. ${verdict.reason}` : verdict.reason}
          </Line>
        )}
        {evidence.acceptBlocked && (
          <Line size="small" color="color.text.subtle">
            {evidence.acceptBlocked}
          </Line>
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
