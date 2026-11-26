import { errorLine } from '../core/errors';
import { keyFromHeaders } from '../core/receipt';
import { ForgeJiraGateway } from '../jira/forge-gateway';
import { ReceiptOutcome, ReceiptService } from '../services/receipts';
import { SqlContractStore } from '../store/sql-store';

const receipts = new ReceiptService(new SqlContractStore(), new ForgeJiraGateway());

/**
 * The web trigger is static: it can only answer with one of the responses listed in
 * the manifest. That keeps the app from sending anything out through it, which is what
 * "Runs on Atlassian" asks for. Each key here is one of those responses.
 */
const OUTPUT: Record<ReceiptOutcome | 'method' | 'error', string> = {
  recorded: 'receipt-recorded',
  recorded_failing: 'receipt-recorded-failing',
  duplicate: 'receipt-duplicate',
  unauthorized: 'receipt-unauthorized',
  invalid: 'receipt-invalid',
  no_work_item: 'receipt-no-work-item',
  no_criterion: 'receipt-no-criterion',
  method: 'receipt-method',
  error: 'receipt-error',
};

/** A project's pipeline reports a test run or a build. Nobody is signed in: the key in the request is the only identity. */
export async function onPipelineReceipt(request: unknown): Promise<{ outputKey: string }> {
  const source = request && typeof request === 'object' ? (request as Record<string, unknown>) : {};
  if (String(source['method'] ?? '').toUpperCase() !== 'POST') return { outputKey: OUTPUT.method };
  try {
    const body = typeof source['body'] === 'string' ? source['body'] : '';
    const result = await receipts.accept(keyFromHeaders(source['headers']), body);
    // The note can name work items, never the key and never the body.
    console.log(`Proof of Done: pipeline receipt ${result.outcome}. ${result.note}`);
    return { outputKey: OUTPUT[result.outcome] };
  } catch (error) {
    console.error(`Proof of Done: a pipeline receipt could not be stored. ${errorLine(error)}`);
    return { outputKey: OUTPUT.error };
  }
}
