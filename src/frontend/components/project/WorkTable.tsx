import React from 'react';
import { DynamicTable, Inline, Link, Lozenge, Text } from '@forge/react';
import type { ProjectView, WorkItemRow } from '../../../services/project-view';
import { attentionNote, contractsLine } from '../../project-text';
import { PROOF_STATE, Tone } from '../../text';

interface Props {
  view: ProjectView;
  /** Address of the Jira site, for links to work items. */
  siteUrl: string | null;
}

const STATUS_TONE: Record<string, Tone> = { new: 'default', indeterminate: 'inprogress', done: 'success' };

// Widths in percent. Left to itself the table gives the proof column too little, and cuts its badge short.
const head = {
  cells: [
    { key: 'item', content: 'Work item', width: 40 },
    { key: 'status', content: 'Status', width: 14 },
    { key: 'proof', content: 'Proof', width: 21 },
    { key: 'needs', content: 'What it needs', width: 25 },
  ],
};

function toRow(row: WorkItemRow, siteUrl: string | null) {
  const badge = PROOF_STATE[row.proofState];
  return {
    key: row.id,
    cells: [
      {
        key: 'item',
        // One text, so the key stays whole and the summary wraps around it.
        content: (
          <Text>
            {siteUrl ? <Link href={`${siteUrl}/browse/${row.key}`}>{row.key}</Link> : row.key} {row.summary}
          </Text>
        ),
      },
      { key: 'status', content: <Lozenge appearance={STATUS_TONE[row.statusCategory] ?? 'default'}>{row.statusName}</Lozenge> },
      {
        key: 'proof',
        // In a narrow table the count goes under the badge, so the badge is not cut short.
        content: (
          <Inline space="space.100" rowSpace="space.025" alignBlock="center" shouldWrap>
            <Lozenge appearance={badge.tone} isBold={row.proofState === 'proven'}>
              {badge.label}
            </Lozenge>
            <Text size="small" color="color.text.subtle">
              {row.proven} of {row.total}
            </Text>
          </Inline>
        ),
      },
      {
        key: 'needs',
        content: <Text color={row.attention === 'closed_unproven' ? 'color.text.danger' : 'color.text'}>{attentionNote(row)}</Text>,
      },
    ],
  };
}

/** Every work item under contract, the ones that need attention first. */
export const WorkTable = ({ view, siteUrl }: Props) => (
  <>
    <Text size="small" color="color.text.subtle">
      {contractsLine(view.contracts)}
      {view.rows.length > 0 ? ' Work that was closed without proof comes first, then evidence that waits for a check.' : ''}
    </Text>
    {view.rows.length > 0 && (
      <DynamicTable
        label="Work items under contract"
        head={head}
        rows={view.rows.map((row) => toRow(row, siteUrl))}
        rowsPerPage={10}
        defaultPage={1}
      />
    )}
  </>
);
