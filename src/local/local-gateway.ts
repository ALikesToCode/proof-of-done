import { adfText } from '../core/adf';
import { IssueContext, IssueInfo, IssueRow, JiraGateway, NewIssue, ProjectInfo, ProofProperty, TransitionInfo } from '../jira/gateway';
import { FileStore } from './file-store';
import { markdownToAdf } from './markdown';
import { STATUSES, STATUS_CATEGORY, STATUS_NAME, Task, TaskFolder, TaskStatus, projectIdOf } from './tasks';

/**
 * The work items the services ask Jira for, served from a folder of task files.
 *
 * Whoever can run the command can read and change the files, so there is nothing to
 * ask about permissions here: every caller may see and edit every task. A team that
 * needs more than that keeps the folder where only the right people can write.
 */

const DAY = 24 * 60 * 60 * 1000;
const OPENED = /^project = (\d+) AND created >= -(\d+)d$/;
const CLOSED = /^project = (\d+) AND statusCategory = Done AND statusCategoryChangedDate >= -(\d+)d$/;

export class LocalWorkGateway implements JiraGateway {
  constructor(
    private readonly tasks: TaskFolder,
    private readonly store: FileStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private toIssue(task: Task): IssueInfo {
    return {
      id: task.key,
      key: task.key,
      projectId: projectIdOf(task.projectKey),
      projectKey: task.projectKey,
      summary: task.summary,
      description: markdownToAdf(task.body),
      issueType: task.type,
      statusName: STATUS_NAME[task.status],
      statusCategory: STATUS_CATEGORY[task.status],
      assigneeAccountId: task.assignee,
      parentKey: task.parent,
    };
  }

  private inProject(projectId: string): Task[] {
    return this.tasks.all().filter((task) => projectIdOf(task.projectKey) === projectId);
  }

  async getIssue(idOrKey: string): Promise<IssueInfo | null> {
    const task = this.tasks.get(idOrKey);
    return task ? this.toIssue(task) : null;
  }

  async canEdit(): Promise<boolean> {
    return true;
  }

  async setProofProperty(_issueId: string, _value: ProofProperty): Promise<void> {
    // The store is the record, and the command line reads it. There is no search index to feed.
  }

  async getStatusCategory(statusId: string): Promise<string | null> {
    return STATUS_CATEGORY[statusId as TaskStatus] ?? null;
  }

  async listTransitions(): Promise<TransitionInfo[]> {
    return STATUSES.map((status) => ({
      id: status,
      name: STATUS_NAME[status],
      toStatusId: status,
      toStatusName: STATUS_NAME[status],
      toCategory: STATUS_CATEGORY[status],
    }));
  }

  async transition(issueId: string, transitionId: string): Promise<void> {
    const task = this.tasks.get(issueId);
    if (!task || !STATUSES.includes(transitionId as TaskStatus)) throw new Error(`Cannot move ${issueId} to ${transitionId}.`);
    this.setStatus(task, transitionId as TaskStatus);
  }

  /** Writes the new status into the task file. Returns the status it had. */
  setStatus(task: Task, status: TaskStatus): TaskStatus {
    const before = task.status;
    if (before === status) return before;
    const moved = STATUS_CATEGORY[before] !== STATUS_CATEGORY[status];
    this.tasks.save({ ...task, status, statusChanged: moved ? this.now() : task.statusChanged });
    return before;
  }

  async addComment(issueId: string, paragraphs: string[]): Promise<void> {
    this.store.addComment({ issueId, at: this.now(), paragraphs });
  }

  async getProject(projectId: string): Promise<ProjectInfo | null> {
    const tasks = this.tasks.all();
    const match = tasks.find((task) => projectIdOf(task.projectKey) === projectId || task.projectKey.toLowerCase() === projectId.toLowerCase());
    if (!match) return null;
    const types = [...new Set(tasks.filter((task) => task.projectKey === match.projectKey).map((task) => task.type))];
    return { id: projectIdOf(match.projectKey), key: match.projectKey, name: match.projectKey, issueTypes: types.map((name) => ({ id: name, name })) };
  }

  async canAdminister(): Promise<boolean> {
    return true;
  }

  /** Answers the two counts the project meter asks for. Any other query is a bug in the caller. */
  async countIssues(jql: string): Promise<number> {
    const opened = OPENED.exec(jql);
    if (opened) {
      const since = this.now() - Number(opened[2]) * DAY;
      return this.inProject(opened[1]!).filter((task) => task.created >= since).length;
    }
    const closed = CLOSED.exec(jql);
    if (closed) {
      const since = this.now() - Number(closed[2]) * DAY;
      return this.inProject(closed[1]!).filter((task) => task.status === 'done' && (task.statusChanged ?? task.created) >= since).length;
    }
    throw new Error('The local adapter cannot answer this query.');
  }

  async getIssueRows(issueIds: string[]): Promise<IssueRow[]> {
    const rows: IssueRow[] = [];
    for (const id of issueIds) {
      const task = this.tasks.get(id);
      if (!task) continue;
      rows.push({
        id: task.key,
        key: task.key,
        summary: task.summary,
        issueType: task.type,
        statusName: STATUS_NAME[task.status],
        statusCategory: STATUS_CATEGORY[task.status],
        assigneeAccountId: task.assignee,
        statusCategoryChangedAt: task.statusChanged ?? task.created,
      });
    }
    return rows;
  }

  async getIssueContext(idOrKey: string): Promise<IssueContext | null> {
    const task = this.tasks.get(idOrKey);
    if (!task) return null;
    const brief = (other: Task) => ({ key: other.key, summary: other.summary, statusName: STATUS_NAME[other.status] });
    const comments = this.store
      .comments(task.key)
      .sort((a, b) => b.at - a.at)
      .map((comment) => ({ author: 'Proof of Done', at: new Date(comment.at).toISOString(), text: comment.paragraphs.join('\n') }));
    return {
      priority: null,
      labels: task.labels,
      components: [],
      assignee: task.assignee,
      reporter: null,
      dueDate: null,
      subtasks: this.tasks
        .all()
        .filter((other) => other.parent === task.key)
        .map(brief),
      links: [],
      comments: comments.slice(0, 10),
      commentTotal: comments.length,
    };
  }

  async createIssue(issue: NewIssue): Promise<{ id: string; key: string }> {
    const project = await this.getProject(issue.projectId);
    if (!project) throw new Error('No such project.');
    const key = this.tasks.nextKey(project.key);
    this.tasks.save({
      key,
      projectKey: project.key,
      summary: issue.summary,
      body: adfText(issue.description).trim(),
      status: 'todo',
      type: issue.issueTypeId || 'Task',
      assignee: null,
      parent: null,
      labels: issue.labels,
      created: this.now(),
      statusChanged: null,
    });
    return { id: key, key };
  }

  async deleteIssue(): Promise<boolean> {
    // Task files belong to the people who wrote them. The adapter never deletes one.
    return false;
  }
}
