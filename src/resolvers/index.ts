import { isForgePlatformError, webTrigger } from '@forge/api';
import Resolver, { Request } from '@forge/resolver';
import { PodError, errorLine } from '../core/errors';
import { ForgeGraphGateway } from '../graph/forge-graph';
import { ForgeJiraGateway } from '../jira/forge-gateway';
import { Caller, ContractService } from '../services/contracts';
import { GateService } from '../services/gate';
import { GraphService } from '../services/graph';
import { ProjectService } from '../services/project';
import { ReceiptService } from '../services/receipts';
import { SampleService } from '../services/sample';
import { SqlContractStore } from '../store/sql-store';

/**
 * The backend of the issue panel and the project pages. Each function runs as the
 * person looking at the page, so Jira decides what they may see and change.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const store = new SqlContractStore();
const jira = new ForgeJiraGateway();
const service = new ContractService(store, jira);
const graphs = new GraphService(service, new ForgeGraphGateway());
const projects = new ProjectService(store, jira);
const samples = new SampleService(store, jira);
const receipts = new ReceiptService(store, jira);
const gate = new GateService(store, jira);

/** Where the project's pipeline posts its results. The same address for every project of the site. */
const pipelineUrl = (): Promise<string> => webTrigger.getUrl('pipeline-receipt');
const resolver = new Resolver();

type Payload = Record<string, unknown>;
type Action<T> = (issueId: string, caller: Caller, payload: Payload) => Promise<T>;
type ProjectAction<T> = (projectId: string, accountId: string | null, payload: Payload) => Promise<T>;

/** Turns what an action returns or throws into the answer the page expects. */
function expose<T>(name: string, action: (request: Request, payload: Payload) => Promise<T>): void {
  resolver.define(name, async (request: Request): Promise<ApiResult<T>> => {
    try {
      const payload: Payload = request.payload && typeof request.payload === 'object' ? (request.payload as Payload) : {};
      return { ok: true, data: await action(request, payload) };
    } catch (error) {
      if (error instanceof PodError) return { ok: false, error: { code: error.code, message: error.message } };
      // Platform errors carry the "allow access" prompt, so Forge has to see them.
      if (error instanceof Error && isForgePlatformError(error)) throw error;
      console.error(`Proof of Done: ${name} failed. ${errorLine(error)}`);
      return { ok: false, error: { code: 'internal', message: 'Something went wrong on our side. Try again in a moment.' } };
    }
  });
}

const accountOf = (request: Request): string | null => (typeof request.context?.accountId === 'string' ? request.context.accountId : null);

/** A function of the issue panel. */
function define<T>(name: string, action: Action<T>): void {
  expose(name, (request, payload) => {
    // The issue id comes from the page and could be altered by the browser. That is
    // fine: every read and write below goes to Jira as this user first.
    const issueId = String(request.context?.extension?.issue?.id ?? '');
    if (!issueId) throw new PodError('invalid', 'Proof of Done only works on a work item.');
    return action(issueId, { accountId: accountOf(request), via: 'ui' }, payload);
  });
}

/** A function of the project page or the project settings page. */
function defineProject<T>(name: string, action: ProjectAction<T>): void {
  expose(name, (request, payload) => {
    // As above: the services ask Jira, as this user, whether they may see or administer the project.
    const projectId = String(request.context?.extension?.project?.id ?? '');
    if (!projectId) throw new PodError('invalid', 'This page only works inside a project.');
    return action(projectId, accountOf(request), payload);
  });
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

define('getContract', (issueId, caller) => service.view(issueId, caller));

define('createContract', (issueId, caller, payload) =>
  service.createContract(issueId, caller, { withSuggestions: payload['withSuggestions'] !== false }),
);

define('addCriterion', (issueId, caller, payload) =>
  service.addCriteria(issueId, caller, [{ text: text(payload['text']), requiredKind: text(payload['requiredKind']) || null }]),
);

define('addSuggested', (issueId, caller) => service.addSuggested(issueId, caller));

define('replaceCriterion', (issueId, caller, payload) =>
  service.replaceCriterion(issueId, caller, text(payload['criterionId']), {
    text: text(payload['text']),
    requiredKind: text(payload['requiredKind']) || null,
  }),
);

define('removeCriterion', (issueId, caller, payload) => service.removeCriterion(issueId, caller, text(payload['criterionId'])));

define('submitEvidence', (issueId, caller, payload) =>
  service.submitEvidence(issueId, caller, {
    criterionId: text(payload['criterionId']),
    kind: text(payload['kind']),
    summary: text(payload['summary']),
    url: text(payload['url']) || null,
    details: payload['details'],
  }),
);

define('recordVerdict', (issueId, caller, payload) =>
  service.recordVerdict(issueId, caller, {
    evidenceId: text(payload['evidenceId']),
    decision: text(payload['decision']),
    reason: text(payload['reason']) || null,
  }),
);

// The gate checks that the caller administers the project. The panel then shows the pass.
define('letThrough', async (issueId, caller, payload) => {
  await gate.letThrough(issueId, caller.accountId, payload['reason']);
  return service.view(issueId, caller);
});

define('getHistory', (issueId) => service.history(issueId));

define('getGraphNote', (issueId, caller, payload) => graphs.noteFor(issueId, caller, text(payload['evidenceId'])));

defineProject('getProject', (projectId, _accountId, payload) => projects.overview(projectId, payload['windowDays']));

defineProject('saveSettings', (projectId, accountId, payload) => projects.saveSettings(projectId, accountId, payload['settings']));

defineProject('loadSample', (projectId, _accountId, payload) => samples.loadOne(projectId, payload['index']));

defineProject('removeSample', (projectId) => samples.remove(projectId));

defineProject('getPipeline', async (projectId) => {
  await projects.requireAdmin(projectId, "see the pipeline's key");
  const [status, url] = await Promise.all([receipts.keyStatus(projectId), pipelineUrl()]);
  return { ...status, url };
});

// The key is in this one answer and nowhere after it: only its hash is stored.
defineProject('createPipelineKey', async (projectId, accountId) => {
  const key = await receipts.createKey(projectId, accountId);
  return { key, url: await pipelineUrl(), ...(await receipts.keyStatus(projectId)) };
});

defineProject('removePipelineKey', async (projectId, accountId) => {
  await receipts.revokeKey(projectId, accountId);
  return { ...(await receipts.keyStatus(projectId)), url: await pipelineUrl() };
});

export const handler = resolver.getDefinitions();
