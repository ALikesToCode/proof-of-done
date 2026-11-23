import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  ErrorMessage,
  Heading,
  HelperMessage,
  Inline,
  LoadingButton,
  RadioGroup,
  SectionMessage,
  Select,
  Stack,
  Text,
  Textfield,
} from '@forge/react';
import type { GateMode, ProjectRule, ProjectSettings, RequiredKind } from '../../../core/types';
import type { ProjectView } from '../../../services/project-view';
import { messageOf, projectApi } from '../../api';
import { GATE_MODES } from '../../project-text';
import { REQUIRED } from '../../text';
import { KIND_OPTIONS } from '../AddCriterion';
import { card, grow, kindSelect, typeSelect } from '../styles';

interface Props {
  view: ProjectView;
  onSaved: (settings: ProjectSettings) => void;
}

const same = (a: ProjectSettings, b: ProjectSettings): boolean => JSON.stringify(a) === JSON.stringify(b);

const ruleLine = (rule: ProjectRule): string => {
  const needs = rule.requiredKind === 'any' ? 'any evidence' : REQUIRED[rule.requiredKind].toLowerCase();
  const scope = rule.issueTypes.length === 0 ? 'every work item type' : rule.issueTypes.join(', ');
  return `Needs ${needs}. Applies to ${scope}.`;
};

/** The project's rules of proof. Project admins change them. Everyone else can read them. */
export const SettingsForm = ({ view, onSaved }: Props) => {
  const [draft, setDraft] = useState<ProjectSettings>(view.settings);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [ruleText, setRuleText] = useState('');
  const [ruleKind, setRuleKind] = useState<RequiredKind>('any');
  const [ruleTypes, setRuleTypes] = useState<string[]>([]);
  const [ruleProblem, setRuleProblem] = useState<string | null>(null);
  // The rule field is uncontrolled so typing never waits. Changing the key clears it.
  const [round, setRound] = useState(0);
  const locked = !view.canAdmin;
  const typeOptions = view.issueTypes.map((name) => ({ label: name, value: name }));

  const change = (patch: Partial<ProjectSettings>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const addRule = () => {
    const text = ruleText.replace(/\s+/g, ' ').trim();
    if (text.length < 3) {
      setRuleProblem('Write the rule first (at least 3 characters).');
      return;
    }
    if (draft.rules.some((rule) => rule.text.toLowerCase() === text.toLowerCase())) {
      setRuleProblem('This project already has that rule.');
      return;
    }
    if (draft.rules.length >= 20) {
      setRuleProblem('A project can have 20 rules.');
      return;
    }
    // The app gives a new rule its id when it saves.
    change({ rules: [...draft.rules, { id: '', text, requiredKind: ruleKind, issueTypes: ruleTypes }] });
    setRuleText('');
    setRuleKind('any');
    setRuleTypes([]);
    setRuleProblem(null);
    setRound((n) => n + 1);
  };

  const save = async () => {
    setSaving(true);
    setProblem(null);
    try {
      const settings = await projectApi.saveSettings(draft);
      setDraft(settings);
      setSaved(true);
      onSaved(settings);
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack space="space.300">
      {locked && (
        <SectionMessage appearance="information">
          <Text>These are the rules of proof for {view.project.name}. Someone who administers the project can change them.</Text>
        </SectionMessage>
      )}

      <Stack space="space.100">
        <Heading size="xsmall" as="h3">
          When a work item is closed without proof
        </Heading>
        <RadioGroup
          name="gate-mode"
          isDisabled={locked}
          options={GATE_MODES.map((mode) => ({ name: 'gate-mode', value: mode.value, label: mode.label }))}
          value={draft.gateMode}
          onChange={(event) => change({ gateMode: String(event.target.value) as GateMode })}
        />
        <HelperMessage>
          This reacts a moment after the work item is closed. To stop the close itself, add the "Proof of Done is complete" validator
          to the transition in the workflow editor. The validator works unless this is set to do nothing.
        </HelperMessage>
      </Stack>

      <Stack space="space.100">
        <Heading size="xsmall" as="h3">
          Who can prove a criterion
        </Heading>
        <Checkbox
          isDisabled={locked}
          isChecked={draft.requireIndependent}
          onChange={(event) => change({ requireIndependent: Boolean(event.target.checked) })}
          label="Evidence has to be accepted by someone other than the person who entered it"
        />
        <HelperMessage>
          A person reviewing what their own coding agent submitted counts as someone else. Turn this off for a team of one. Proof that
          was self-reviewed stays labelled as such.
        </HelperMessage>
      </Stack>

      <Stack space="space.100">
        <Heading size="xsmall" as="h3">
          Work items without a contract
        </Heading>
        <Checkbox
          isDisabled={locked}
          isChecked={draft.enforceWithoutContract}
          onChange={(event) => change({ enforceWithoutContract: Boolean(event.target.checked) })}
          label="Treat a work item that has no contract as not proven"
        />
        <HelperMessage>Leave this off while only part of the project uses contracts.</HelperMessage>
      </Stack>

      <Stack space="space.100">
        <Heading size="xsmall" as="h3">
          Project rules
        </Heading>
        <Text size="small" color="color.text.subtle">
          A rule is a criterion that every new contract in this project starts with, next to the ones from the work item's description.
        </Text>
        {draft.rules.length === 0 && <Text color="color.text.subtle">No rules yet.</Text>}
        {draft.rules.map((rule) => (
          <Box key={rule.id || rule.text} xcss={card}>
            <Inline spread="space-between" alignBlock="center">
              <Stack space="space.025">
                <Text weight="medium">{rule.text}</Text>
                <Text size="small" color="color.text.subtle">
                  {ruleLine(rule)}
                </Text>
              </Stack>
              {!locked && (
                <Button appearance="subtle" spacing="compact" onClick={() => change({ rules: draft.rules.filter((r) => r !== rule) })}>
                  Remove
                </Button>
              )}
            </Inline>
          </Box>
        ))}
        {!locked && (
          <Stack space="space.050">
            <Inline space="space.100" alignBlock="center" shouldWrap>
              <Box xcss={grow}>
                <Textfield
                  key={`rule-${round}`}
                  name="rule"
                  placeholder="Add a rule, for example: All unit tests pass"
                  maxLength={500}
                  onChange={(event) => setRuleText(String(event.target.value ?? ''))}
                />
              </Box>
              <Box xcss={kindSelect}>
                <Select
                  inputId="rule-kind"
                  options={KIND_OPTIONS}
                  value={KIND_OPTIONS.find((option) => option.value === ruleKind)}
                  onChange={(option: { value: RequiredKind } | null) => setRuleKind(option?.value ?? 'any')}
                />
              </Box>
              <Box xcss={typeSelect}>
                <Select
                  key={`rule-types-${round}`}
                  inputId="rule-types"
                  isMulti
                  placeholder="Every work item type"
                  options={typeOptions}
                  onChange={(options: Array<{ value: string }> | null) => setRuleTypes((options ?? []).map((option) => option.value))}
                />
              </Box>
              <Button onClick={addRule}>Add rule</Button>
            </Inline>
            {ruleProblem && <ErrorMessage>{ruleProblem}</ErrorMessage>}
          </Stack>
        )}
      </Stack>

      {!locked && (
        <Stack space="space.100">
          <Inline space="space.150" alignBlock="center">
            <LoadingButton appearance="primary" isLoading={saving} isDisabled={same(draft, view.settings)} onClick={save}>
              Save settings
            </LoadingButton>
            {saved && same(draft, view.settings) && (
              <Text size="small" color="color.text.success">
                Saved.
              </Text>
            )}
            {!same(draft, view.settings) && (
              <Text size="small" color="color.text.subtle">
                You have changes that are not saved.
              </Text>
            )}
          </Inline>
          {problem && (
            <SectionMessage appearance="error">
              <Text>{problem}</Text>
            </SectionMessage>
          )}
        </Stack>
      )}
    </Stack>
  );
};
