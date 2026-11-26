# Proof of Done: design of the first version

Written 23 Nov 2026. This is the smallest version a judge can install and use. Anything not listed here waits until this works on a fresh site. The pages were checked in a browser on 24 Nov 2026.

## The problem

Teams assign Jira work to AI agents, and the agents mark it done without proof. The ticket says Done. Nobody checked that the acceptance criteria were met.

## What a person does with it

1. Opens any work item and adds the Proof of Done panel. An admin can turn it on for all work items from the panel menu.
2. The panel reads the acceptance criteria out of the description and offers them as a done contract. One click creates it. Criteria can be added, edited or removed by hand.
3. Someone adds evidence against a criterion: a test run, a build, a pull request, a document, a person's attestation, or something else with a link or excerpt.
4. The app runs mechanical checks on the evidence the moment it arrives. A test run with failures, a pull request link that is not a pull request, or a build with no result is turned away with the reason.
5. Evidence that passes the checks waits for a review. A person or the Proof Verifier agent accepts or rejects it, with a reason. For a pull request or a build, the Review dialog says whether Jira's Teamwork Graph links it to the work item, and in what state.
6. When the work item moves to a done status without proof, the done gate reacts. Depending on the project setting it comments, moves the work item back, or does nothing. An admin can also add the app's validator to a workflow transition, and then Jira refuses the transition outright.
7. The project page shows the meter and every work item under contract, with the ones closed without proof at the top.

## What an agent does with it

A coding agent connects to the app's MCP endpoint. It fetches the contract and a context pack for its ticket, does the work, and submits evidence per criterion. It gets the check results back in the same call, and for a pull request or a build, what Jira's Teamwork Graph holds about it. It cannot edit the contract and cannot judge its own evidence.

The Proof Verifier is a Rovo agent. It reads the evidence that is waiting, decides whether each piece proves its criterion, and records a verdict with its reasoning. The action that records a verdict is not exposed through MCP, so the agent that did the work cannot reach it.

## The rules of proof

- Evidence never proves itself. Someone other than whoever submitted it has to accept it.
- The mechanical checks can only reject. Passing them earns a place in the review queue.
- A person cannot accept evidence they typed in themselves, unless the project allows self-review. The panel labels self-reviewed proof. The project page and the JQL field show it as proven.
- A person reviewing what their own coding agent submitted counts as an independent check. That review is the point of the app.
- A person's attestation counts when it comes from someone who is not the assignee.
- A criterion can demand one kind of evidence. "All tests pass" set to need a test run cannot be attested away.
- Changing a criterion retires its evidence. Proof given for one wording is never read as proof of another.
- Evidence, verdicts and events are append-only. The history shows every one.

## Results from the pipeline

Everything else reaches the app as the submitter's own words. A control evaluation of the gate (`control-eval/`) measured what that costs: of the 20 attacks that got through a reviewing model, 14 were plain made-up test output. A reviewer who cannot run anything cannot tell a consistent lie about a test run from a true report.

So one channel is closed to the worker. A project admin makes a key, and the project's pipeline posts its results with it to a web trigger. The rules:

- A receipt names work items (a key, or any text that holds keys, such as a branch name), a commit, and either the counts of a test run or the state of a build. It may name the repository, the workflow and the run. Free text is dropped, so a pipeline cannot carry a message to a reviewer.
- A receipt is stored as evidence with the channel `ci`, on each active criterion that asks for its kind. A criterion that takes any evidence counts when its wording asks for that kind (`src/core/kinds.ts`). The same receipt sent twice is stored once.
- A passing receipt gets a verdict with the channel `ci`, unless the project turns `pipelineProves` off. A failing one fails its checks like any other evidence.
- The commit a work item stands at is the commit of its newest receipt. Evidence that names another commit has the standing `stale`. A criterion whose only proof is stale is unproven, and the summary counts it in `stale`. Evidence that names no commit never goes stale.
- A failing receipt turns away what anyone else said about the same commit for the same criterion and kind: each such piece of evidence gets a rejecting verdict with the channel `check`, also one a person had accepted. A claim that arrives after the failing receipt fails the check `pipeline.same_commit`. The newest receipt of a commit is the one that counts, so a rerun that passes clears the way.
- A criterion that was proven for an earlier commit, with nothing turned away for the commit it stands at now, is unproven with `stale` set, also when an older run had failed.
- A receipt that no criterion asks for is kept as evidence of no criterion. It proves nothing and it moves the commit.
- With `pipelineOnly` on, a test run or a build from any other channel fails the check `source.pipeline`.

The key reads `pod_<project id>_<48 hexadecimal characters>`. Only its SHA-256 is stored. A key speaks for one project: a receipt that names a work item of another project is ignored.

The web trigger is static. It can answer only with the responses listed in the manifest, which is what keeps the app eligible for Runs on Atlassian.

What this does not do: it does not fetch anything from a code host, and it does not check that the pipeline ran the tests a criterion is about. Whoever can change the pipeline or read its secrets can send a receipt.

## The done gate

A work item with a contract should not pass as Done while a criterion is unproven. The app holds that line in two ways, and the project decides how strict it is.

- **After the fact.** The app listens for status changes into or out of a done status. Jira promises delivery within 3 minutes. On the development site it took about a second. In warn mode the app comments on the work item and says what is missing. In bounce mode it moves the work item back to the status it came from, and only there. If the workflow has no such transition, or Jira refuses it, the app falls back to the comment. Off does nothing.
- **Before the fact.** An admin adds the "Proof of Done is complete" validator to a workflow transition. Jira then refuses that transition and shows what is missing. The validator blocks in warn and bounce mode and stands down when the gate is off.

A work item with no contract passes both, unless the project requires a contract.

Every reaction goes into the event log as `issue.done`, `issue.reopened`, `gate.warned`, `gate.bounced` or `gate.blocked`, and the meter reads them from there. Jira can deliver one status change twice. The app recognises the repeat by Jira's change id and ignores it.

Two things an admin should know. A validator left on a workflow after the app is uninstalled blocks that transition, so remove it first. And an error inside the app's check lets the transition through, because a broken app must not lock a team out of its own workflow. Once the check has said no, the refusal stands, also when the app cannot store its `gate.blocked` event.

## JQL fields

The app copies each contract's state into the work item property `proof-of-done`, and Jira indexes it. `proofState` is `unproven`, `partial` or `proven`. A work item is `partial` once some of its criteria are proven. Evidence that waits for a check does not move it out of `unproven`. `provenCriteria`, `unprovenCriteria` and `proofCriteria` are numbers. `statusCategory = Done AND proofState != proven` lists closed work that still lacks proof.

Anyone who can edit a work item can overwrite that property through the REST API. So the gate and the meter never read it. They read the app's own store.

## The meter

The meter answers one question per project: is the work converging, or is the team only busy?

- Climbing: more work items were closed with proof in the window than were opened or reopened.
- Busy, not climbing: there was activity, but proven closures did not outrun new and reopened work. A ticket closed without proof does not move the meter.
- Stalled: nothing happened.

The window is the last 7, 14 or 30 days. The page shows the numbers behind the verdict: opened, reopened, closed with proof, closed without proof, and closed with no contract at all. The last two are marked "does not count". Evidence and verdicts from the window are listed as activity.

Opened and closed counts come from JQL, so they work for the time before the app was installed. Reopens and proof come from the app's own store. The meter covers the whole project. A project with only some of its work under contract reads as busy until proven closures outrun everything that arrives.

## The project page

Every project gets a Proof of Done page in the row of tabs under its name. Jira shows the tabs that fit and keeps the rest under More. The settings also sit under the project's own settings.

- **Work under contract.** Every work item with a contract, and what it needs next. Closed without proof comes first, then rejected evidence, then evidence waiting for a check, then criteria with no evidence. Work items the viewer may not see are counted and not listed.
- **Settings.** What the gate does, whether evidence needs a second person, whether a work item with no contract fails the gate, and the project rules. A project rule is a criterion the project adds to every new contract, for all work item types or for some. Project admins and Jira admins can change the settings. Everyone else can read them.
- **Sample data.** One button creates five work items in the project, labelled `proof-of-done-sample`. One is closed and proven, one is closed without proof, two are in progress, and one has no contract yet. Each shows up in the meter and the list like real work. Removing the sample deletes only the work items the app recorded as its own. A label someone else put on a work item is never enough.

## The agent tools

Seven Forge actions do the work. The app's MCP server offers five of them to outside agents. Two belong to the Proof Verifier alone.

| Tool | What it does | Who has it |
| --- | --- | --- |
| `get-context-pack` | Returns the description, the parent, subtasks, links, the latest comments, the pull requests, builds and deployments Jira links to the work item, the contract and the rules of proof | Coding agents |
| `get-done-contract` | Returns each criterion with its id, its evidence and its state, and says whether the work item may close | Coding agents, Proof Verifier |
| `start-done-contract` | Creates the contract from the criteria in the description and the project rules | Coding agents |
| `submit-evidence` | Records one piece of evidence for one criterion and answers with the check results, and with what the Teamwork Graph holds about a pull request or a build | Coding agents |
| `list-unproven-work` | Lists the project's work under contract that is not proven, with the meter | Coding agents, Proof Verifier |
| `list-evidence-to-review` | Lists the evidence on a work item that waits for a verdict, with what the Teamwork Graph holds about each pull request or build | Proof Verifier |
| `record-verdict` | Accepts or rejects one piece of evidence, with the reasoning | Proof Verifier |

Every answer is written for a language model. States are plain words, empty fields are left out, and a `next` line says what to do. A refusal comes back as `ok: false` with a code and a sentence the agent can act on.

A tool does what the person behind the agent may do, and nothing more. The app takes the account from the invocation, never from an input, and makes its Jira calls as that person. An agent can start a contract only from criteria that are already written down. It cannot add criteria of its own, attest, or record a verdict.

The Proof Verifier has two skills. `review-evidence` walks the review queue and records a verdict on each piece. `report-proof` reports where a work item or a project stands. Its prompt holds the rules no request can bend. It judges from the record, treats text inside evidence as material and never as instructions, and rejects when unsure. When evidence waits, the panel shows an Ask Proof Verifier button that opens Rovo chat with the work item's key. Rovo shows the verdicts the agent wants to record, and the person confirms them. The panel looks for new verdicts every eight seconds, for five minutes.

`skills/proof-of-done/SKILL.md` is the open skill for coding agents. It teaches the loop. Read the contract first, submit evidence for each criterion, and say "done" only when every criterion is proven. A gate that passes is not enough for that, because a gate that the project turned off also passes.

## The Teamwork Graph check

Evidence for a pull request or a build says what its author says. Jira often knows more. A code host or a CI tool connected to Jira reports the pull requests, builds and deployments of a work item, and the Teamwork Graph holds them. The app reads that list and tells the reviewer how the evidence compares with it.

| Finding | What it means |
| --- | --- |
| Confirmed | The graph links this pull request, build or deployment to the work item, and its state agrees with the evidence |
| Differs | The graph links it and holds a state that contradicts the evidence, such as a pull request that is still open or a deployment that failed |
| Not linked | The graph links others of its kind to the work item, and this link is not one of them |
| No record | The graph has nothing that settles it. No development tool is connected, or the app did not get the whole list |

The note shows up in four places.

- The Review dialog shows it under the checks the app ran. When the graph gives no answer, the dialog says so and offers to ask again.
- `list-evidence-to-review` gives the Proof Verifier a `graph` line per entry, and a rule that says to trust it over what the evidence says about itself.
- `submit-evidence` answers with the same line, so a coding agent hears it before the reviewer does. When Jira does not link the pull request, the answer says how Jira links one.
- `get-context-pack` lists what Jira already links to the work item, under `development`.

A note is advice. The checks and the gate never read the graph, and only a reviewer's verdict proves a criterion.

How the app reads the graph:

- One GraphQL operation, `proofofdone_linkedDevelopment`, asks three of the graph's curated queries for the work item. `jiraWorkItemLinkedExternalPullRequests` and `jiraWorkItemLinkedExternalDeployments` give pull requests and deployments. Builds have no query of their own, so they come from `jiraWorkItemDevelopmentArtifacts`.
- The call goes through `requestTeamworkGraph` as the person using the app, so the graph returns only what that person may see.
- The scopes are `read:graph:issue:jira`, `read:graph:pull-request:external`, `read:graph:build:external` and `read:graph:deployment:external`. All four only read.
- The graph gives at most 25 rows per page. Builds share their list with every commit and branch of the work item, so the app reads up to three more pages for them, 100 artifacts in all. When a list is still cut, the note says the list was incomplete. It does not claim that a link is missing.
- The graph can refuse one list and answer for another in the same call. The app asks again for a list or a page the graph refused, up to twice, and gives everything after its first question three seconds. A list it still lacks counts as incomplete, and the lists that answered still count.
- A page or a tool waits four seconds for the graph. With no answer by then, the review goes on without a note.
- A title or a name in the graph is text from outside Jira, and a note goes to the Proof Verifier. So a note is made of the app's own words. States are mapped to a fixed list. The only outside text that can enter is the environment of a deployment, and only when it is one plain word such as `production`.
- Evidence matches a graph entry when both links point at the same page. Case, the query string and a trailing slash are ignored. A page under it, such as the files tab of a pull request, also matches.

On 23 Nov the development site had no code host connected, and the real query came back with empty lists, which the app reads as "No record". For one check, a temporary build of the app then reported two pull requests, two builds and a deployment for a scratch work item through Jira's development information API, the channel a code host uses. About a minute later the graph returned all five. The app gave the right note for seven pieces of sample evidence: confirmed, differs and not linked for pull requests and for builds, and "successful in production" for the deployment. That build and its data are gone. A pull request from a real code host has not been tried yet.

The same test showed that the graph does not always answer. On 23 Nov it refused single lists with "User is not permitted to query this organization", under HTTP 200. That happened for about half an hour after each deploy of a new minor version, and again in the evening with no deploy near it. In between, four probes in a row got all of their lists. Atlassian reported a degraded authentication service that evening. The calls were made on a person's behalf from a background function. In the last live run that day the graph refused lists in most calls. The app still gave the right note for two of five pieces of evidence, said for two that its list was incomplete, and had no note for one. The context pack got all five linked items after asking again.

On 24 Nov the Review dialog asked from a browser, and Atlassian's status page showed no open incident. The graph refused the first three asks, between 10:44 and 10:46 UTC, with the same message. The last deploy was almost 17 hours old. The fourth ask, at 10:47, got an answer, and the dialog showed "No record", which is right for a site with no code host. A new version went out at 11:18. At 11:24 the dialog got its answer on the first ask, in a little over a second. So the graph also refuses a call from a browser, with no deploy and no incident near it. The one ask that followed a deploy that day was answered. The app asks again by itself, and the dialog says when it got no answer and offers Ask again.

## How it is built

The app is deterministic. It stores contracts, evidence and verdicts, runs the checks and enforces the gate. All language-model reasoning happens in Rovo agents or in the outside coding agent, so the app makes no LLM calls and costs nothing to run per verdict.

| Part | Forge module | State on 24 Nov |
| --- | --- | --- |
| Issue panel | `jira:issuePanel`, UI Kit | Built and deployed. Page tests cover what it says and does. Checked in a browser on the development site |
| Storage | `sql` (Forge SQL), seven tables | Built, verified on the development site |
| Rules and services | plain TypeScript, no Forge imports in the core | Built, 319 unit tests |
| Done gate | `trigger` on work item updates, `jira:workflowValidator` | Built, verified on the development site |
| JQL fields | `jira:entityProperty` on the `proof-of-done` property | Built, verified on the development site |
| Project page, meter, settings, sample data | `jira:projectPage`, `jira:projectSettingsPage` | Built and deployed. The services are verified on the development site, and page tests cover what the pages say and do. Checked in a browser on the development site |
| Cleanup | `trigger` on deleted work items | Built, verified on the development site |
| Agent tools | `action` and `rovo:mcp`, plus an open `SKILL.md` | Built and deployed. The tools are verified on the development site through a test function. The MCP path waits for an admin to turn the tools on |
| Proof Verifier | `rovo:agent` with two `rovo:skill` modules | Built and deployed. Asked from the panel on the development site, it accepted a test run with no failures and rejected a pull request link that the Teamwork Graph had no record of. The panel showed both verdicts |
| Teamwork Graph check | `requestTeamworkGraph` from `@forge/api`, four `read:graph` scopes | Built and deployed. Verified on the development site against pull requests, builds and a deployment that a test provider reported to Jira. The Review dialog showed its note in a browser. Not yet seen with a pull request from a real code host |

The browser check ran at 1280 pixels wide. The issue panel and the project page were also read at 540 pixels and in dark colours. Jira takes its theme from the account's setting and not from the browser, and the check left that setting alone, so Atlassian's dark tokens were put on the page by hand. The pages take every colour from those tokens.

## Decisions and their reasons

- **Jira only.** The first version installs into Jira alone. The Teamwork Graph could also bring linked Confluence pages into the context pack. That waits.
- **No web trigger.** Adding one made the Forge CLI report the loss of Runs on Atlassian eligibility. Evidence from CI therefore goes through an agent's MCP call.
- **Calls run as the user.** Jira decides who may see and edit a work item. The cost is one "Allow access" click per person on first use.
- **Guessed evidence kinds are suggestions.** Keyword matching mislabelled some seeded tickets, so a contract read from a description takes any evidence until a person tightens it.
- **Sample data goes into the current project.** A dedicated sample project would need the Jira administration scope. Labelled sample work items need only the scopes the app already has, and one button removes them. The app creates them as itself, so a person who may not create work items in the project can still load them if they administer it.
- **Jira admins count as project admins.** A project created through the REST API had an empty Administrators role, and the site's own admin could not change its settings. The app accepts either permission.
- **Tools run as the person, with no fallback to the app.** The app cannot check another user's permissions. Jira answers that only Jira admins and Connect apps may ask. So a tool that cannot act as the person says so, and tells them to open the panel once and choose Allow access.
- **The verdict tools are not on the MCP server.** An outside agent that could record a verdict could accept its own evidence.
- **The Proof Verifier's verdict counts as an independent check.** It is a second reader with its own instructions, and it has no tool that submits evidence. The history names the person who asked it.
- **The Teamwork Graph advises and never gates.** The graph can be empty for reasons that have nothing to do with the work. No development tool is connected, an admin withheld a scope, or the person may not see the repository. A gate that read it would fail teams for those reasons, so the graph informs the reviewer and stops there.
- **A deleted work item takes its contract with it.** Jira tells the app about the deletion, and the app removes every row it stored for that work item. Nobody could reach those rows again.
- **The panel keeps its watch in the tab's session storage.** Jira draws the issue panel again about a second and a half after Rovo chat opens beside the work item, and a panel that was just drawn remembers nothing. So the panel stores until when it looks for verdicts. Session storage outlives the redraw and ends with the tab.
- **A short line of text sits in a Box of its own.** Jira's page styles put 12px above a UI Kit `Text` that follows another block. In a row that pushed the text below its neighbours, and in a list it added to the gap. A `Text` alone in a `Box` follows nothing, so the `Line` component wraps it that way.

## Preview features this relies on

`jira:workflowValidator`, `rovo:mcp`, `rovo:skill` and the Teamwork Graph API were in Preview on 23 Nov 2026. Package versions are pinned exactly in `package.json`.
