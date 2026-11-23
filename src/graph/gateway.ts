import { LinkedWork } from '../core/graph';

export interface GraphGateway {
  /**
   * The pull requests, builds and deployments the Teamwork Graph links to a work item,
   * as the calling user may see them. Null when the graph gave no usable answer.
   */
  linkedWork(issueId: string): Promise<LinkedWork | null>;
}
