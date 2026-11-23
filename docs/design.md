# Proof of Done: design of the first version

Written 23 Nov 2026. This is the smallest version a judge can install and use. Anything not listed here waits until this works on a fresh site.

## The problem

Teams assign Jira work to AI agents, and the agents mark it done without proof. The ticket says Done. Nobody checked that the acceptance criteria were met.

## What a person does with it

1. Opens any work item and adds the Proof of Done panel. An admin can turn it on for all work items from the panel menu.
2. The panel reads the acceptance criteria out of the description and offers them as a done contract. One click creates it. Criteria can be added, edited or removed by hand.
3. Someone adds evidence against a criterion: a test run, a build, a pull request, a document, a person's attestation, or something else with a link or excerpt.
4. The app runs mechanical checks on the evidence the moment it arrives. A test run with failures, a pull request link that is not a pull request, or a build with no result is turned away with the reason.
5. Evidence that passes the checks waits for a review. A person or the Proof Verifier agent accepts or rejects it, with a reason.
6. When the work item moves to a done status without proof, the done gate reacts. Depending on the project setting it comments, moves the work item back, or does nothing.
7. The project page shows the meter and the list of work items that are done but not proven.

## What an agent does with it

A coding agent connects to the app's MCP endpoint. It fetches the contract and a context pack for its ticket, does the work, and submits evidence per criterion. It gets the check results back in the same call. It cannot edit the contract and cannot judge its own evidence.

The Proof Verifier is a Rovo agent. It reads the evidence that is waiting, decides whether each piece proves its criterion, and records a verdict with its reasoning. The action that records a verdict is not exposed through MCP, so the agent that did the work cannot reach it.

## The rules of proof

- Evidence never proves itself. Someone other than whoever submitted it has to accept it.
- The mechanical checks can only reject. Passing them earns a place in the review queue.
- A person cannot accept evidence they typed in themselves, unless the project allows self-review. Self-reviewed proof is labelled as such everywhere.
- A person reviewing what their own coding agent submitted counts as an independent check. That review is the point of the app.
- A person's attestation counts when it comes from someone who is not the assignee.
- A criterion can demand one kind of evidence. "All tests pass" set to need a test run cannot be attested away.
- Changing a criterion retires its evidence. Proof given for one wording is never read as proof of another.
- Evidence, verdicts and events are append-only. The history shows every one.

## How it is built

The app is deterministic. It stores contracts, evidence and verdicts, runs the checks and enforces the gate. All language-model reasoning happens in Rovo agents or in the outside coding agent, so the app makes no LLM calls and costs nothing to run per verdict.

| Part | Forge module | State on 23 Nov |
| --- | --- | --- |
| Issue panel | `jira:issuePanel`, UI Kit | Built, deployed to the development site |
| Storage | `sql` (Forge SQL), six tables | Built, verified on the development site |
| Rules and service | plain TypeScript, no Forge imports in the core | Built, 111 unit tests |
| Done gate | `trigger` on work item updates, `jira:workflowValidator` | Next |
| JQL fields | `jira:entityProperty` on the `proof-of-done` property | Next |
| Project page, meter, sample data | `jira:projectPage`, `jira:projectSettingsPage` | After the gate |
| Agent tools | `action` and `rovo:mcp`, plus an open `SKILL.md` | After the project page |
| Proof Verifier | `rovo:agent` with `rovo:skill` | After the agent tools |
| Linked pages and pull requests | Teamwork Graph API | Last |

## The meter

The meter answers one question per project: is the work converging, or is the team only busy?

- Climbing: more work items were closed with proof in the window than were opened or reopened.
- Busy, not climbing: there was activity, but proven closures did not outrun new and reopened work. A ticket closed without proof does not move the meter.
- Stalled: nothing happened.

Opened and closed counts come from JQL, so they work for the time before the app was installed. Reopens and proof come from the app's own event log.

## Decisions and their reasons

- **Jira only.** The first version installs into Jira alone. Linked Confluence pages reach the context pack through Teamwork Graph later.
- **No web trigger.** Adding one made the Forge CLI report the loss of Runs on Atlassian eligibility. Evidence from CI therefore goes through an agent's MCP call.
- **Calls run as the user.** Jira decides who may see and edit a work item. The cost is one "Allow access" click per person on first use.
- **Guessed evidence kinds are suggestions.** Keyword matching mislabelled some seeded tickets, so a contract read from a description takes any evidence until a person tightens it.
- **Sample data goes into the current project.** A dedicated sample project would need the Jira administration scope. Labelled sample work items need only the scopes the app already has, and one button removes them.

## Preview features this relies on

`jira:workflowValidator`, `rovo:mcp`, `rovo:skill` and the Teamwork Graph API were in Preview on 23 Nov 2026. Package versions are pinned exactly in `package.json`.
