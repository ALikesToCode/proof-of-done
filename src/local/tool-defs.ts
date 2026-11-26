import { MCP_TOOLS, ToolName } from '../actions/tools';

/**
 * What the local tool server tells an agent about each tool. The names and the inputs
 * are the ones in manifest.yml, and a test compares the two, so an agent that learned
 * the tools on Jira finds the same ones here.
 */

interface Property {
  type: 'string' | 'integer';
  description: string;
}

export interface ToolDef {
  name: ToolName;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, Property>; required: string[]; additionalProperties: false };
}

const KEY: Property = { type: 'string', description: 'The key of the work item, for example POD-12.' };

const def = (name: ToolName, description: string, properties: Record<string, Property>, required: string[]): ToolDef => ({
  name,
  description,
  inputSchema: { type: 'object', properties, required, additionalProperties: false },
});

const ALL: ToolDef[] = [
  def(
    'get-context-pack',
    'Call this before starting work on a work item. Returns the description, the parent, subtasks, recent comments, and the done contract: the criteria that must be proven before the work counts as done.',
    { issueKey: KEY },
    ['issueKey'],
  ),
  def(
    'get-done-contract',
    'Returns the done contract of a work item: each criterion with its id, the evidence submitted so far and whether it is proven. Also says whether the work item may be closed yet. Call it again after submitting evidence.',
    { issueKey: KEY },
    ['issueKey'],
  ),
  def(
    'start-done-contract',
    'Creates the done contract of a work item from the acceptance criteria in its description and the rules of its project. Use it when get-done-contract says the work item has no contract yet. It cannot add criteria of your own.',
    { issueKey: KEY },
    ['issueKey'],
  ),
  def(
    'submit-evidence',
    'Submits one piece of evidence for one criterion of a done contract: a test run, a build, a pull request, a document or other evidence. The answer says at once whether it passed the automatic checks. Evidence that passes still waits for a review by a person.',
    {
      criterionId: { type: 'string', description: 'The id of the criterion this evidence is for, as returned by get-done-contract.' },
      kind: { type: 'string', description: 'One of test_run, build, pull_request, document or other.' },
      summary: { type: 'string', description: 'One or two sentences on what this evidence shows about the criterion.' },
      url: { type: 'string', description: 'A link to the test run, build, pull request or document. A pull request and a document need one.' },
      passed: { type: 'integer', description: 'For a test run, how many tests passed.' },
      failed: { type: 'integer', description: 'For a test run, how many tests failed.' },
      status: { type: 'string', description: 'For a build, its result, such as passed or failed. For a pull request, its state, such as open or merged.' },
      commit: { type: 'string', description: 'The commit the evidence is about.' },
      excerpt: {
        type: 'string',
        description: 'The part of the output that shows the result, at most 4,000 characters. Put the command first, on a line of its own, as in "$ npm test".',
      },
      agentName: { type: 'string', description: 'The name of the agent or tool that submits this, for example claude-code.' },
    },
    ['criterionId', 'kind', 'summary'],
  ),
  def(
    'list-unproven-work',
    'Lists the work items of a project that have a done contract and are not fully proven, with what each still needs. Work closed without proof comes first. Also returns the project meter: climbing, busy but not climbing, or stalled.',
    {
      projectKey: { type: 'string', description: 'The key of the project, for example POD.' },
      windowDays: { type: 'integer', description: 'The window of the project meter. 7, 14 or 30 days. The default is 7.' },
    },
    ['projectKey'],
  ),
];

/** The tools an agent gets. Recording a verdict is not among them. */
export const AGENT_TOOL_DEFS: ToolDef[] = ALL.filter((tool) => MCP_TOOLS.includes(tool.name));
