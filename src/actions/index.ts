import { ForgeJiraGateway } from '../jira/forge-gateway';
import { AgentService } from '../services/agent';
import { ContractService } from '../services/contracts';
import { ProjectService } from '../services/project';
import { SqlContractStore } from '../store/sql-store';
import { ToolName, runTool } from './tools';

/**
 * One Forge function per action. Jira calls run as the person who authorised the
 * agent, so a tool never shows an agent more than that person may see.
 */

const store = new SqlContractStore();
const jira = new ForgeJiraGateway();
const agent = new AgentService(new ContractService(store, jira), new ProjectService(store, jira), jira, store);

const tool = (name: ToolName) => (payload: unknown, context: unknown) => runTool(agent, name, payload, context);

export const getContextPack = tool('get-context-pack');
export const getDoneContract = tool('get-done-contract');
export const startDoneContract = tool('start-done-contract');
export const submitEvidence = tool('submit-evidence');
export const listUnprovenWork = tool('list-unproven-work');
export const listEvidenceToReview = tool('list-evidence-to-review');
export const recordVerdict = tool('record-verdict');
