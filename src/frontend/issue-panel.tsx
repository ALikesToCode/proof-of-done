import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, { Inline, SectionMessage, SectionMessageAction, Spinner, Stack, Text } from '@forge/react';
import { events } from '@forge/bridge';
import type { ContractView, CriterionView, EvidenceView } from '../services/view';
import { api, messageOf } from './api';
import { AddCriterion } from './components/AddCriterion';
import { Criterion } from './components/Criterion';
import { CriterionModal } from './components/CriterionModal';
import { EvidenceModal } from './components/EvidenceModal';
import { HistoryModal } from './components/HistoryModal';
import { NoContract } from './components/NoContract';
import { ReviewModal } from './components/ReviewModal';
import { Summary } from './components/Summary';

type Dialog =
  | { type: 'evidence'; criterion: CriterionView }
  | { type: 'edit'; criterion: CriterionView }
  | { type: 'review'; criterion: CriterionView; evidence: EvidenceView }
  | { type: 'history' }
  | null;

const App = () => {
  const [view, setView] = useState<ContractView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [addingSuggested, setAddingSuggested] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await api.getContract());
      setProblem(null);
    } catch (error) {
      setProblem(messageOf(error));
    }
  }, []);

  useEffect(() => {
    void load();
    // Jira tells the panel when the work item changes, for example when someone edits
    // the description or moves it to another status.
    const subscription = events.on('JIRA_ISSUE_CHANGED', () => void load());
    return () => {
      void subscription.then((s) => s.unsubscribe()).catch(() => undefined);
    };
  }, [load]);

  const saved = (next: ContractView) => {
    setView(next);
    setDialog(null);
    setProblem(null);
  };

  const addSuggested = async () => {
    setAddingSuggested(true);
    try {
      saved(await api.addSuggested());
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setAddingSuggested(false);
    }
  };

  if (!view) {
    return problem ? (
      <SectionMessage appearance="error" title="Proof of Done could not load">
        <Text>{problem}</Text>
      </SectionMessage>
    ) : (
      <Spinner label="Loading the done contract" />
    );
  }

  if (!view.exists) return <NoContract view={view} onChanged={saved} />;

  const now = Date.now();
  const missing = view.suggestions.length;
  return (
    <Stack space="space.150">
      <Summary view={view} onHistory={() => setDialog({ type: 'history' })} />
      {problem && (
        <SectionMessage appearance="error">
          <Text>{problem}</Text>
        </SectionMessage>
      )}
      {view.criteria.length === 0 && (
        <Text color="color.text.subtle">This contract has no criteria yet. Add the first one below.</Text>
      )}
      {view.criteria.map((criterion) => (
        <Criterion
          key={criterion.id}
          criterion={criterion}
          canEdit={view.canEdit}
          now={now}
          onAddEvidence={() => setDialog({ type: 'evidence', criterion })}
          onEdit={() => setDialog({ type: 'edit', criterion })}
          onReview={(evidence) => setDialog({ type: 'review', criterion, evidence })}
        />
      ))}
      {missing > 0 && view.canEdit && (
        <SectionMessage
          appearance="information"
          actions={[
            <SectionMessageAction key="add" onClick={addSuggested}>
              {addingSuggested ? 'Adding' : missing === 1 ? 'Add it' : 'Add them'}
            </SectionMessageAction>,
          ]}
        >
          <Text>
            {missing === 1
              ? `One criterion for this work item is not in the contract: "${view.suggestions[0]?.text}"`
              : `${missing} criteria for this work item are not in the contract, for example "${view.suggestions[0]?.text}"`}
          </Text>
        </SectionMessage>
      )}
      {view.canEdit && <AddCriterion onChanged={saved} />}
      {!view.canEdit && (
        <Inline>
          <Text size="small" color="color.text.subtle">
            You can read this contract. Changing it or adding evidence needs permission to edit the work item.
          </Text>
        </Inline>
      )}
      {dialog?.type === 'evidence' && <EvidenceModal criterion={dialog.criterion} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.type === 'edit' && <CriterionModal criterion={dialog.criterion} onClose={() => setDialog(null)} onSaved={saved} />}
      {dialog?.type === 'review' && (
        <ReviewModal criterion={dialog.criterion} evidence={dialog.evidence} onClose={() => setDialog(null)} onSaved={saved} />
      )}
      {dialog?.type === 'history' && <HistoryModal issueKey={view.issue.key} onClose={() => setDialog(null)} />}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
