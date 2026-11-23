import { isForgePlatformError } from '@forge/api';
import Resolver, { Request } from '@forge/resolver';
import { PodError } from '../core/errors';
import { ForgeJiraGateway } from '../jira/forge-gateway';
import { Caller, ContractService } from '../services/contracts';
import { SqlContractStore } from '../store/sql-store';

/**
 * The backend of the issue panel. Each function runs as the person looking at the
 * work item, so Jira decides what they may see and edit.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const service = new ContractService(new SqlContractStore(), new ForgeJiraGateway());
const resolver = new Resolver();

type Payload = Record<string, unknown>;
type Action<T> = (issueId: string, caller: Caller, payload: Payload) => Promise<T>;

function define<T>(name: string, action: Action<T>): void {
  resolver.define(name, async (request: Request): Promise<ApiResult<T>> => {
    try {
      const context = request.context ?? {};
      // The issue id comes from the page and could be altered by the browser. That is
      // fine: every read and write below goes to Jira as this user first.
      const issueId = String(context.extension?.issue?.id ?? '');
      if (!issueId) throw new PodError('invalid', 'Proof of Done only works on a work item.');
      const caller: Caller = { accountId: typeof context.accountId === 'string' ? context.accountId : null, via: 'ui' };
      const payload: Payload = request.payload && typeof request.payload === 'object' ? (request.payload as Payload) : {};
      return { ok: true, data: await action(issueId, caller, payload) };
    } catch (error) {
      if (error instanceof PodError) return { ok: false, error: { code: error.code, message: error.message } };
      // Platform errors carry the "allow access" prompt, so Forge has to see them.
      if (error instanceof Error && isForgePlatformError(error)) throw error;
      console.error(`Proof of Done: ${name} failed.`, error);
      return { ok: false, error: { code: 'internal', message: 'Something went wrong on our side. Try again in a moment.' } };
    }
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

define('getHistory', (issueId) => service.history(issueId));

export const handler = resolver.getDefinitions();
