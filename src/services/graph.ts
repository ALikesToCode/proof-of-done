import { PodError, errorLine } from '../core/errors';
import { GraphNote, LinkedWork, compareWithGraph, graphCovers } from '../core/graph';
import { GraphGateway } from '../graph/gateway';
import { Caller, ContractService } from './contracts';

/** How long a page or a tool waits for the graph before it goes on without it. */
const GRAPH_WAIT_MS = 4_000;

export interface GraphNoteView {
  /** Null when the graph has no say on this evidence, or gave no answer. */
  note: GraphNote | null;
}

/**
 * Asks the Teamwork Graph what Jira links to a work item. The graph is a second
 * source for a reviewer and never a gate, so nothing here may fail a review or a
 * tool call: a slow or broken graph reads as no answer.
 */
export class GraphService {
  constructor(
    private readonly contracts: ContractService,
    private readonly graph: GraphGateway,
    private readonly waitMs: number = GRAPH_WAIT_MS,
  ) {}

  /** The pull requests, builds and deployments linked to a work item, or null when the graph gave no answer in time. */
  async linked(issueId: string): Promise<LinkedWork | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const late = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), this.waitMs);
      });
      return await Promise.race([this.graph.linkedWork(issueId), late]);
    } catch (error) {
      // One line, and never the answer: it can name a team's pull requests.
      console.warn(`Proof of Done: the Teamwork Graph could not be read. ${errorLine(error)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** What the graph says about one piece of evidence on a work item the caller may see. */
  async noteFor(issueRef: string, caller: Caller, evidenceId: string): Promise<GraphNoteView> {
    const view = await this.contracts.view(issueRef, caller);
    const evidence = view.criteria.flatMap((criterion) => criterion.evidence).find((item) => item.id === evidenceId);
    if (!evidence) throw new PodError('not_found', 'That evidence is not on this work item any more. Reload the panel.');
    if (!graphCovers(evidence)) return { note: null };
    const linked = await this.linked(view.issue.id);
    return { note: linked ? compareWithGraph(evidence, linked) : null };
  }
}
