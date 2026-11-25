# Proof of Done without Jira

The local adapter puts the same guard on agents that work from a repository with no Jira site. Tasks are Markdown files, the store is one JSON file, and the rules are the ones the Jira app runs: the same contract, the same checks, the same verdict rule and the same gate.

It has three users.

- **A person** writes the criteria, reviews evidence and closes work, at the command line.
- **An agent** reads the contract and submits evidence, through a tool server with five tools. It has no tool that records a verdict.
- **A harness or a pipeline** asks the gate, and gets an exit code.

## Set up

You need Node.js 22 or newer.

```
git clone https://github.com/ALikesToCode/proof-of-done.git
cd proof-of-done
npm ci
npm run build
npm link
```

`npm link` puts the `proof-of-done` command on your path. Without it, run `node /path/to/proof-of-done/dist/local/cli.js` in its place. The package is not on npm.

In the repository your agents work in:

```
proof-of-done init
proof-of-done new "Export the audit log as CSV" -c "All unit tests pass" -c "Release notes are updated"
proof-of-done start POD-1
```

`init` creates `.proof-of-done/`. `new` writes `.proof-of-done/tasks/POD-1.md`, and `start` turns the criteria in that file into the contract.

## Task files

```
---
status: todo
type: Task
assignee: dana
---
# Export the audit log as CSV

## Acceptance criteria

- All unit tests pass
- Release notes are updated
```

The file name is the key. `status` is `todo`, `in-progress` or `done`. Write a task in any editor. The app reads criteria from a list under a heading or a label such as "Acceptance criteria", "Definition of done" or "Done when", the same way the Jira app reads a description.

Commit `.proof-of-done/` with the code. The store, `state.json`, then shows in a pull request who accepted what.

## What a person does

| Command | What it does |
| --- | --- |
| `proof-of-done list` | Every task and where its proof stands |
| `proof-of-done show POD-1` | The contract, with each criterion's id, its evidence and the verdicts |
| `proof-of-done criterion POD-1 "The export has a header row" --needs test_run` | Adds a criterion. `--needs` limits it to one kind of evidence |
| `proof-of-done review` | The evidence that waits for a verdict |
| `proof-of-done accept EVIDENCE_ID` | Accepts one piece |
| `proof-of-done reject EVIDENCE_ID --reason "One test is not the suite."` | Rejects one piece. A rejection needs a reason |
| `proof-of-done attest POD-1 CRITERION_ID "I read the notes and the export is listed."` | Gives your word for a criterion. It proves the criterion when you are not the assignee |
| `proof-of-done move POD-1 done` | Closes the task. The command refuses while a criterion is unproven |
| `proof-of-done settings POD --gate off` | Changes what the project enforces. Also `--independent on|off` and `--require-contract on|off` |
| `proof-of-done meter POD` | Whether the project is climbing, busy or stalled |

The command takes your name from `--as`, then from `POD_USER`, then from your login name.

## Connect an agent

The tool server speaks the Model Context Protocol over stdio. In Claude Code, from the repository the agent works in:

```
claude mcp add proof-of-done -- proof-of-done mcp
```

Any other MCP client starts the same command, `proof-of-done mcp`. Then give the agent the skill in [skills/proof-of-done](../skills/proof-of-done/SKILL.md).

The server offers `get-context-pack`, `get-done-contract`, `start-done-contract`, `submit-evidence` and `list-unproven-work`. Evidence is recorded under the name of the person who started the server.

## Hold the gate

`proof-of-done gate` answers with an exit code.

| Exit code | Meaning |
| --- | --- |
| 0 | Every task that was asked about passes the gate |
| 1 | At least one does not, and the output says what is missing |
| 2 | The command could not tell: a wrong key, an unreadable store |

Name the tasks, or choose them with `--all`, `--closed` or `--in-progress`. `--json` prints the result as JSON.

**In a pipeline.** This step fails the build when a task was closed without proof, also when someone set `status: done` in the file by hand:

```
proof-of-done gate --closed
```

**In an agent harness.** With `--hook`, the gate is built for the moment an agent wants to stop. It exits with 2 and lists the open criteria on stderr while the agent can still add evidence. When all that is left is a person's review, it exits with 0 and says that the work is not done yet. In Claude Code, a Stop hook reads exit code 2 as "do not stop" and hands stderr to the agent. In `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "proof-of-done gate --in-progress --hook" }] }]
  }
}
```

Claude Code lets the agent stop after a Stop hook has held it eight times in a row with no tool call in between.

## What the local adapter cannot promise

- **It cannot tell a person from an agent that runs commands as that person.** The commands that decide something, such as `accept`, `reject`, `attest`, `start` and `criterion`, refuse to run outside a terminal. An agent that is given a terminal of its own, or the variable `POD_ALLOW_NONINTERACTIVE=1`, gets past that. Keep reviews with a person, and run `proof-of-done gate` in a pipeline the agent cannot change. Verdicts signed with a reviewer's key are not built.
- **Anyone who can write the folder can edit the store.** Committing it makes an edit visible in review. It does not prevent one.
- **A pull request or a build has no second source.** The Jira app compares them with what the code host reported to Jira. Here the reviewer has only what the evidence says.
- **No reviewing agent.** The Jira app has the Proof Verifier. Here a person gives every verdict.
- **One file.** Every command reads the whole store. Nobody has measured it on a store with thousands of tasks.
