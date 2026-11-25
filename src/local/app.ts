import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AgentService } from '../services/agent';
import { ContractService } from '../services/contracts';
import { GateService } from '../services/gate';
import { ProjectService } from '../services/project';
import { FileStore, storeFile } from './file-store';
import { LocalWorkGateway } from './local-gateway';
import { TaskFolder } from './tasks';

/** The folder that holds the task files and the store. */
export const HOME = '.proof-of-done';

export interface LocalApp {
  root: string;
  tasks: TaskFolder;
  store: FileStore;
  work: LocalWorkGateway;
  contracts: ContractService;
  projects: ProjectService;
  gate: GateService;
  agent: AgentService;
}

/** The nearest `.proof-of-done` folder at or above `from`, or null. */
export function findRoot(from: string): string | null {
  let dir = resolve(from);
  for (;;) {
    const candidate = join(dir, HOME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The same services the Jira app runs, on a folder of task files and a JSON store.
 * There is no Teamwork Graph here, so a pull request or a build gets no second source.
 */
export function openLocal(root: string, now?: () => number): LocalApp {
  const tasks = new TaskFolder(join(root, 'tasks'));
  const store = new FileStore(storeFile(root));
  const work = new LocalWorkGateway(tasks, store, now);
  const contracts = new ContractService(store, work, now);
  const projects = new ProjectService(store, work, now);
  const gate = new GateService(store, work, now);
  const agent = new AgentService(contracts, projects, work, store, { linked: async () => null });
  return { root, tasks, store, work, contracts, projects, gate, agent };
}
