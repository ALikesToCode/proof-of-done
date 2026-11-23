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
6. When the work item moves to a done status without proof, the done gate reacts. Depending on the project setting it comments, moves the work item back, or does nothing. An admin can also add the app's validator to a workflow transition, and then Jira refuses the transition outright.
7. The project page shows the meter and every work item under contract, with the ones closed without proof at the top.

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

## The done gate

A work item with a contract should not pass as Done while a criterion is unproven. The app holds that line in two ways, and the project decides how strict it is.

- **After the fact.** The app listens for status changes into or out of a done status. Jira promises delivery within 3 minutes. On the development site it took about a second. In warn mode the app comments on the work item and says what is missing. In bounce mode it moves the work item back to the status it came from, and only there. If the workflow has no such transition, or Jira refuses it, the app falls back to the comment. Off does nothing.
- **Before the fact.** An admin adds the "Proof of Done is complete" validator to a workflow transition. Jira then refuses that transition and shows what is missing. The validator blocks in warn and bounce mode and stands down when the gate is off.

A work item with no contract passes both, unless the project requires a contract.

Every reaction goes into the event log as `issue.done`, `issue.reopened`, `gate.warned`, `gate.bounced` or `gate.blocked`, and the meter reads them from there. Jira can deliver one status change twice. The app recognises the repeat by Jira's change id and ignores it.

Two things an admin should know. A validator left on a workflow after the app is uninstalled blocks that transition, so remove it first. And an error inside the app's check lets the transition through, because a broken app must not lock a team out of its own workflow.

## JQL fields

The app copies each contract's state into the work item property `proof-of-done`, and Jira indexes it. `proofState` is `unproven`, `partial` or `proven`. `provenCriteria`, `unprovenCriteria` and `proofCriteria` are numbers. `statusCategory = Done AND proofState != proven` lists closed work that still lacks proof.

Anyone who can edit a work item can overwrite that property through the REST API. So the gate and the meter never read it. They read the app's own store.

## The meter

The meter answers one question per project: is the work converging, or is the team only busy?

- Climbing: more work items were closed with proof in the window than were opened or reopened.
- Busy, not climbing: there was activity, but proven closures did not outrun new and reopened work. A ticket closed without proof does not move the meter.
- Stalled: nothing happened.

The window is the last 7, 14 or 30 days. The page shows the numbers behind the verdict: opened, reopened, closed with proof, closed without proof, and closed with no contract at all. The last two are marked "does not count". Evidence and verdicts from the window are listed as activity.

Opened and closed counts come from JQL, so they work for the time before the app was installed. Reopens and proof come from the app's own store. The meter covers the whole project. A project with only some of its work under contract reads as busy until proven closures outrun everything that arrives.

## The project page

Every project gets a Proof of Done page in its sidebar. The settings also sit under the project's own settings.

- **Work under contract.** Every work item with a contract, and what it needs next. Closed without proof comes first, then rejected evidence, then evidence waiting for a check, then criteria with no evidence. Work items the viewer may not see are counted and not listed.
- **Settings.** What the gate does, whether evidence needs a second person, whether a work item with no contract fails the gate, and the project rules. A project rule is a criterion the project adds to every new contract, for all work item types or for some. Project admins and Jira admins can change the settings. Everyone else can read them.
- **Sample data.** One button creates five work items in the project, labelled `proof-of-done-sample`. One is closed and proven, one is closed without proof, two are in progress, and one has no contract yet. Each shows up in the meter and the list like real work. Removing the sample deletes only the work items the app recorded as its own. A label someone else put on a work item is never enough.

## How it is built

The app is deterministic. It stores contracts, evidence and verdicts, runs the checks and enforces the gate. All language-model reasoning happens in Rovo agents or in the outside coding agent, so the app makes no LLM calls and costs nothing to run per verdict.

| Part | Forge module | State on 23 Nov |
| --- | --- | --- |
| Issue panel | `jira:issuePanel`, UI Kit | Built, deployed to the development site |
| Storage | `sql` (Forge SQL), seven tables | Built, verified on the development site |
| Rules and services | plain TypeScript, no Forge imports in the core | Built, 179 unit tests |
| Done gate | `trigger` on work item updates, `jira:workflowValidator` | Built, verified on the development site |
| JQL fields | `jira:entityProperty` on the `proof-of-done` property | Built, verified on the development site |
| Project page, meter, settings, sample data | `jira:projectPage`, `jira:projectSettingsPage` | Built and deployed. The services are verified on the development site, the pages are not yet checked in a browser |
| Cleanup | `trigger` on deleted work items | Built, verified on the development site |
| Agent tools | `action` and `rovo:mcp`, plus an open `SKILL.md` | Next |
| Proof Verifier | `rovo:agent` with `rovo:skill` | After the agent tools |
| Linked pages and pull requests | Teamwork Graph API | Last |

## Decisions and their reasons

- **Jira only.** The first version installs into Jira alone. Linked Confluence pages reach the context pack through Teamwork Graph later.
- **No web trigger.** Adding one made the Forge CLI report the loss of Runs on Atlassian eligibility. Evidence from CI therefore goes through an agent's MCP call.
- **Calls run as the user.** Jira decides who may see and edit a work item. The cost is one "Allow access" click per person on first use.
- **Guessed evidence kinds are suggestions.** Keyword matching mislabelled some seeded tickets, so a contract read from a description takes any evidence until a person tightens it.
- **Sample data goes into the current project.** A dedicated sample project would need the Jira administration scope. Labelled sample work items need only the scopes the app already has, and one button removes them. The app creates them as itself, so a person who may not create work items in the project can still load them if they administer it.
- **Jira admins count as project admins.** A project created through the REST API had an empty Administrators role, and the site's own admin could not change its settings. The app accepts either permission.
- **A deleted work item takes its contract with it.** Jira tells the app about the deletion, and the app removes every row it stored for that work item. Nobody could reach those rows again.

## Preview features this relies on

`jira:workflowValidator`, `rovo:mcp`, `rovo:skill` and the Teamwork Graph API were in Preview on 23 Nov 2026. Package versions are pinned exactly in `package.json`.
