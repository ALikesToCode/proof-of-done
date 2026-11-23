import { invoke } from '@forge/bridge';
import type { ContractView, EvidenceInput, HistoryEntry, VerdictInput } from '../services/view';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function call<T>(name: string, payload: Record<string, unknown> = {}): Promise<T> {
  const result = (await invoke(name, payload)) as ApiResult<T> | undefined;
  if (!result || typeof result !== 'object' || !('ok' in result)) {
    throw new ApiError('internal', 'The app returned an answer the panel does not understand. Reload the page.');
  }
  if (!result.ok) throw new ApiError(result.error.code, result.error.message);
  return result.data;
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again in a moment.';
}

export const api = {
  getContract: () => call<ContractView>('getContract'),
  createContract: (withSuggestions: boolean) => call<ContractView>('createContract', { withSuggestions }),
  addCriterion: (text: string, requiredKind: string) => call<ContractView>('addCriterion', { text, requiredKind }),
  addSuggested: () => call<ContractView>('addSuggested'),
  replaceCriterion: (criterionId: string, text: string, requiredKind: string) =>
    call<ContractView>('replaceCriterion', { criterionId, text, requiredKind }),
  removeCriterion: (criterionId: string) => call<ContractView>('removeCriterion', { criterionId }),
  submitEvidence: (input: EvidenceInput) => call<ContractView>('submitEvidence', { ...input }),
  recordVerdict: (input: VerdictInput) => call<ContractView>('recordVerdict', { ...input }),
  getHistory: () => call<HistoryEntry[]>('getHistory'),
};
