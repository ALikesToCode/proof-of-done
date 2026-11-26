import { PodError } from '../core/errors';
import { newId } from '../core/ids';
import { GUIDE_AGENT, GUIDE_COMMITS, GUIDE_ITEM, GUIDE_SLUG, GUIDE_STEPS, GUIDE_WORKFLOW, GuideStep, GuideStepId } from '../core/sample';
import { IssueInfo, JiraGateway, ProjectInfo } from '../jira/gateway';
import { ContractStore, EventRow } from '../store/types';
import { Caller, ContractService } from './contracts';
import { requireAdmin } from './project';
import { GuideLine, GuideView } from './project-view';
import { ReceiptService } from './receipts';
import { SampleService } from './sample';

const PROJECT_ID = /^\d{1,18}$/;
export const GUIDE_EVENT = 'sample.step';
const HISTORY = 60;

/**
 * The guided run. A project admin presses through six steps on one sample work item and
 * sees an agent's "done" turned away by the pipeline's result, and proof go stale on a
 * new commit.
 *
 * Nothing is scripted but the inputs. The contract is made by the contract service from
 * the description, the agent's claim goes through the call a coding agent makes, the
 * pipeline's results go through the code that stores a receipt, and the answer shown
 * after each step is the done gate's own. What is simulated is who sent them, and every
 * such record says so: the agent calls itself "(sample)", and the pipeline's results
 * carry the workflow name of the guided run.
 */
export class GuideService {
  private readonly now: () => number;
  private readonly contracts: ContractService;
  private readonly receipts: ReceiptService;
  private readonly samples: SampleService;

  constructor(
    private readonly store: ContractStore,
    private readonly jira: JiraGateway,
    now?: () => number,
  ) {
    this.now = now ?? (() => Date.now());
    this.contracts = new ContractService(store, jira, now);
    this.receipts = new ReceiptService(store, jira, now);
    this.samples = new SampleService(store, jira, now);
  }

  /** Where the run stands in this project. */
  async state(projectId: string): Promise<GuideView> {
    const project = await this.project(projectId);
    const issue = await this.issue(project);
    return this.view(issue, issue ? await this.taken(issue) : []);
  }

  /**
   * Runs the next step. `expected` is the step the page offered, so a second press, or
   * a press in another tab, does not run a step the person did not see.
   */
  async advance(projectId: string, accountId: string | null, expected: unknown): Promise<GuideView> {
    const project = await this.project(projectId);
    await requireAdmin(this.jira, project, 'run the guided sample');
    let issue = await this.issue(project);
    const taken = issue ? await this.taken(issue) : [];
    const step = GUIDE_STEPS[taken.length];
    if (!step) throw new PodError('conflict', 'The guided run is over. Remove the sample to run it again.');
    if (expected !== step.id) throw new PodError('conflict', 'The guided run has moved on. Reload the page to see where it stands.');

    const person: Caller = { accountId, via: 'ui' };
    if (step.id === 'start') {
      issue = issue ?? (await this.start(project));
      const existing = await this.store.getBundle(issue.id);
      if (!existing.contract) await this.contracts.createContract(issue.id, person, { withSuggestions: true });
    } else {
      if (!issue) throw new PodError('conflict', 'The sample work item of the guided run is gone. Remove the sample and start again.');
      await this.run(step.id, issue, accountId);
    }

    // The answer shown for the step is the gate's, read after the step, never a scripted one.
    const after = await this.contracts.view(issue.id, person);
    const at = this.now();
    await this.store.insertEvent({
      id: newId(at),
      projectId: project.id,
      issueId: issue.id,
      type: GUIDE_EVENT,
      at,
      actorAccountId: accountId,
      channel: 'sample',
      data: { step: step.id, pass: after.gate.pass, reason: after.gate.reason },
    });
    return this.view(issue, await this.taken(issue));
  }

  private async run(step: Exclude<GuideStepId, 'start'>, issue: IssueInfo, accountId: string | null): Promise<void> {
    const result = (commit: string, fields: Record<string, unknown>): string =>
      JSON.stringify({ issue: issue.key, commit, repository: 'sample/storefront', workflow: GUIDE_WORKFLOW, ...fields });
    const tests = (commit: string, passed: number, failed: number): string =>
      result(commit, { passed, failed, summary: `Sample pipeline result: ${passed} passed, ${failed} failed on commit ${commit.slice(0, 7)}` });
    switch (step) {
      case 'claim': {
        const view = await this.contracts.view(issue.id, { accountId, via: 'ui' });
        const criterion = view.criteria[0];
        if (!criterion) throw new PodError('conflict', 'The contract of the sample work item has no criterion left. Remove the sample and start again.');
        await this.contracts.submitEvidence(
          issue.id,
          { accountId, via: 'agent', agentName: GUIDE_AGENT },
          {
            criterionId: criterion.id,
            kind: 'test_run',
            summary: 'Sample claim: all 12 checkout tests pass on my branch',
            url: null,
            details: { passed: 12, failed: 0, command: 'npm test -- checkout', commit: GUIDE_COMMITS.first },
          },
        );
        return;
      }
      case 'pipeline_fails':
        await this.receipts.acceptSample(issue, tests(GUIDE_COMMITS.first, 10, 2));
        return;
      case 'fix_passes':
        await this.receipts.acceptSample(issue, tests(GUIDE_COMMITS.fix, 12, 0));
        return;
      case 'new_commit':
        await this.receipts.acceptSample(
          issue,
          result(GUIDE_COMMITS.next, { status: 'success', summary: `Sample pipeline result: build of commit ${GUIDE_COMMITS.next.slice(0, 7)} succeeded` }),
        );
        return;
      case 'passes_again':
        await this.receipts.acceptSample(issue, tests(GUIDE_COMMITS.next, 13, 0));
        return;
    }
  }

  private async start(project: ProjectInfo): Promise<IssueInfo> {
    const { created } = await this.samples.create(project, GUIDE_ITEM);
    const issue = await this.jira.getIssue(created.id, 'user');
    if (!issue) throw new PodError('not_found', `The app made ${created.key}, but you cannot see it. Check the project's permissions.`);
    return issue;
  }

  /** The sample work item of the run, or null when there is none or it was deleted in Jira. */
  private async issue(project: ProjectInfo): Promise<IssueInfo | null> {
    const marker = (await this.store.listSampleIssues(project.id)).find((sample) => sample.slug === GUIDE_SLUG);
    if (!marker) return null;
    const issue = await this.jira.getIssue(marker.issueId, 'user');
    if (issue) return issue;
    // Gone for the app too means deleted. Forget it, so the run can start again.
    if (!(await this.jira.getIssue(marker.issueId, 'app'))) await this.store.purgeIssue(marker.issueId);
    return null;
  }

  /** The steps taken so far, oldest first, each once. */
  private async taken(issue: IssueInfo): Promise<EventRow[]> {
    const events = (await this.store.listEvents(issue.id, HISTORY)).filter((event) => event.type === GUIDE_EVENT).reverse();
    const taken: EventRow[] = [];
    for (const step of GUIDE_STEPS) {
      const event = events.find((candidate) => candidate.data['step'] === step.id);
      if (!event) break;
      taken.push(event);
    }
    return taken;
  }

  private view(issue: IssueInfo | null, taken: EventRow[]): GuideView {
    const key = issue?.key ?? null;
    const lines: GuideLine[] = taken.map((event, index) => {
      const step = GUIDE_STEPS[index] as GuideStep;
      return {
        id: step.id,
        text: step.done.replace('{key}', key ?? 'the work item'),
        pass: event.data['pass'] === true,
        reason: typeof event.data['reason'] === 'string' ? event.data['reason'] : '',
      };
    });
    const next = GUIDE_STEPS[taken.length];
    return { key, lines, next: next ? { id: next.id, label: next.label } : null, total: GUIDE_STEPS.length };
  }

  private async project(projectId: string): Promise<ProjectInfo> {
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    if (!PROJECT_ID.test(id)) throw new PodError('invalid', 'The guided run needs a project.');
    const project = await this.jira.getProject(id, 'user');
    if (!project) throw new PodError('not_found', 'This project does not exist, or you do not have access to it.');
    return project;
  }
}
