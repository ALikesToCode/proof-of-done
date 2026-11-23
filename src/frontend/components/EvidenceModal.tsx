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
  Select,
  Stack,
  Text,
  TextArea,
  Textfield,
} from '@forge/react';
import { runChecks, sanitizeDetails } from '../../core/checks';
import { suggestKind } from '../../core/extract';
import { EVIDENCE_KINDS, EvidenceKind } from '../../core/types';
import type { ContractView, CriterionView } from '../../services/view';
import { api, messageOf } from '../api';
import { KIND, REQUIRED } from '../text';

const KIND_OPTIONS = EVIDENCE_KINDS.map((kind) => ({ label: KIND[kind], value: kind }));
const BUILD_RESULTS = [
  { label: 'Passed', value: 'passed' },
  { label: 'Failed', value: 'failed' },
];
const PULL_REQUEST_STATES = [
  { label: 'Merged', value: 'merged' },
  { label: 'Open', value: 'open' },
  { label: 'Closed without merging', value: 'closed' },
];

const SUMMARY_HINT: Record<EvidenceKind, string> = {
  test_run: 'Which tests ran, and against what? For example: full unit suite on the login branch.',
  build: 'Which build is it, and what does it cover?',
  pull_request: 'What does the pull request change that meets this criterion?',
  document: 'What does the document show?',
  attestation: 'Say what you checked and how. Your name and the time are recorded with it.',
  other: 'What is it, and why does it prove the criterion?',
};

interface Props {
  criterion: CriterionView;
  onClose: () => void;
  onSaved: (view: ContractView) => void;
}

type Fields = Record<'summary' | 'url' | 'passed' | 'failed' | 'command' | 'status' | 'commit' | 'text', string>;
const EMPTY: Fields = { summary: '', url: '', passed: '', failed: '', command: '', status: '', commit: '', text: '' };

function startingKind(criterion: CriterionView): EvidenceKind | null {
  if (criterion.requiredKind !== 'any') return criterion.requiredKind;
  const guess = suggestKind(criterion.text);
  return guess === 'any' ? null : guess;
}

/** The form a person uses to add evidence by hand. */
export const EvidenceModal = ({ criterion, onClose, onSaved }: Props) => {
  const locked = criterion.requiredKind !== 'any';
  const [kind, setKind] = useState<EvidenceKind | null>(startingKind(criterion));
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const set = (name: keyof Fields) => (event: { target: { value?: unknown } }) =>
    setFields((current) => ({ ...current, [name]: String(event.target.value ?? '') }));
  const choose = (name: keyof Fields) => (option: { value: string } | null) =>
    setFields((current) => ({ ...current, [name]: option?.value ?? '' }));

  const submit = async () => {
    if (!kind) {
      setProblems(['Choose what kind of evidence this is.']);
      return;
    }
    const summary = fields.summary.replace(/\s+/g, ' ').trim();
    const url = fields.url.trim() || null;
    const details = sanitizeDetails({
      passed: kind === 'test_run' ? fields.passed : undefined,
      failed: kind === 'test_run' ? fields.failed : undefined,
      command: kind === 'test_run' ? fields.command : undefined,
      status: kind === 'build' || kind === 'pull_request' ? fields.status : undefined,
      commit: kind === 'build' ? fields.commit : undefined,
      text: kind === 'other' ? fields.text : undefined,
    });
    // The same checks run again on the server. Running them here first means a person
    // sees what is wrong before anything is stored.
    const failed = runChecks({ requiredKind: criterion.requiredKind, kind, summary, url, details, channel: 'ui' }).filter((check) => !check.ok);
    if (failed.length > 0) {
      setProblems(failed.map((check) => check.note));
      return;
    }
    setSaving(true);
    setProblems([]);
    try {
      onSaved(await api.submitEvidence({ criterionId: criterion.id, kind, summary, url, details }));
    } catch (error) {
      setProblems([messageOf(error)]);
      setSaving(false);
    }
  };

  return (
    <ModalTransition>
      <Modal onClose={onClose}>
        <ModalHeader>
          <ModalTitle>Add evidence</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Stack space="space.150">
            <Stack space="space.050">
              <Text size="small" color="color.text.subtle">
                Criterion
              </Text>
              <Text weight="medium">{criterion.text}</Text>
            </Stack>
            <Stack space="space.050">
              <Label labelFor="evidence-kind">Kind of evidence</Label>
              <Select
                inputId="evidence-kind"
                options={KIND_OPTIONS}
                isDisabled={locked}
                placeholder="Choose a kind"
                value={KIND_OPTIONS.find((option) => option.value === kind) ?? null}
                onChange={(option: { value: EvidenceKind } | null) => {
                  setKind(option?.value ?? null);
                  setProblems([]);
                }}
              />
              {locked && <HelperMessage>This criterion only takes {REQUIRED[criterion.requiredKind].toLowerCase()}.</HelperMessage>}
            </Stack>
            {kind && (
              <Stack space="space.050">
                <Label labelFor="evidence-summary">{kind === 'attestation' ? 'What you attest' : 'What it shows'}</Label>
                <TextArea id="evidence-summary" name="summary" maxLength={1000} onChange={set('summary')} />
                <HelperMessage>{SUMMARY_HINT[kind]}</HelperMessage>
              </Stack>
            )}
            {kind && kind !== 'attestation' && (
              <Stack space="space.050">
                <Label labelFor="evidence-url">
                  {kind === 'pull_request' || kind === 'document' ? 'Link' : 'Link (optional)'}
                </Label>
                <Textfield id="evidence-url" name="url" placeholder="https://" maxLength={2000} onChange={set('url')} />
              </Stack>
            )}
            {kind === 'test_run' && (
              <Stack space="space.100">
                <Inline space="space.200">
                  <Stack space="space.050">
                    <Label labelFor="evidence-passed">Tests passed</Label>
                    <Textfield id="evidence-passed" name="passed" type="number" min={0} onChange={set('passed')} />
                  </Stack>
                  <Stack space="space.050">
                    <Label labelFor="evidence-failed">Tests failed</Label>
                    <Textfield id="evidence-failed" name="failed" type="number" min={0} onChange={set('failed')} />
                  </Stack>
                </Inline>
                <Stack space="space.050">
                  <Label labelFor="evidence-command">Command (optional)</Label>
                  <Textfield id="evidence-command" name="command" isMonospaced placeholder="npm test" onChange={set('command')} />
                </Stack>
              </Stack>
            )}
            {kind === 'build' && (
              <Stack space="space.100">
                <Stack space="space.050">
                  <Label labelFor="evidence-result">Result</Label>
                  <Select inputId="evidence-result" options={BUILD_RESULTS} placeholder="Choose a result" onChange={choose('status')} />
                </Stack>
                <Stack space="space.050">
                  <Label labelFor="evidence-commit">Commit (optional if there is a link)</Label>
                  <Textfield id="evidence-commit" name="commit" isMonospaced onChange={set('commit')} />
                </Stack>
              </Stack>
            )}
            {kind === 'pull_request' && (
              <Stack space="space.050">
                <Label labelFor="evidence-state">State (optional)</Label>
                <Select inputId="evidence-state" options={PULL_REQUEST_STATES} placeholder="Choose a state" isClearable onChange={choose('status')} />
              </Stack>
            )}
            {kind === 'other' && (
              <Stack space="space.050">
                <Label labelFor="evidence-text">Excerpt (optional if there is a link)</Label>
                <TextArea id="evidence-text" name="text" isMonospaced maxLength={4000} onChange={set('text')} />
                <HelperMessage>Paste the lines that matter, for example the end of a log.</HelperMessage>
              </Stack>
            )}
            {kind === 'attestation' && (
              <SectionMessage appearance="information">
                <Text>
                  An attestation is your own word. It proves the criterion when you are not the assignee of this work item.
                  Otherwise a second person has to confirm it.
                </Text>
              </SectionMessage>
            )}
            {problems.length > 0 && (
              <SectionMessage appearance="error" title="This would not count as evidence yet">
                {problems.map((problem) => (
                  <Text key={problem}>{problem}</Text>
                ))}
              </SectionMessage>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button appearance="subtle" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton appearance="primary" isLoading={saving} onClick={submit}>
            Add evidence
          </LoadingButton>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
};
