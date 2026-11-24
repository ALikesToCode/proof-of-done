# Proof of Done

Proof of Done is a Forge app for Jira that makes Done mean proven. A work item gets a done contract, the list of criteria that have to hold before it closes. A criterion counts as proven when a piece of evidence for it passes the app's checks and a reviewer accepts it. By default a person cannot accept evidence they typed in themselves. A person's attestation is the exception. The app accepts it without a second person when the person who gives it is not the assignee of the work item.

It is built for teams that hand Jira work to AI coding agents. The agent reads the contract, does the work and submits evidence for each criterion. A person or a second agent judges the evidence. When a ticket with an unproven contract reaches Done, the app comments on it or moves it back, or the workflow refuses the move. By default the app leaves a ticket that has no contract alone.

Entry for Codegeist 2026, category Apps for Software Teams.

## The problem

Teams assign Jira work to AI agents, and the agents mark it done without proof. The ticket says Done. Nobody checked that the acceptance criteria were met.

## What it does

- **Done contract.** The issue panel reads the acceptance criteria out of the description and offers them as a contract. People can add, change and remove criteria, and a project can set rules that every new contract starts with.
- **Evidence with checks.** Evidence is a test run, a build, a pull request, a document, a person's attestation, or something else with a link or an excerpt. The app checks each piece the moment it arrives. A test run with failures, a link that is not a pull request, or a build with no result is turned away with the reason.
- **A verdict on each piece.** Evidence that passes the checks waits for a review, except an attestation, which the app accepts when it arrives. A person or the Proof Verifier, a Rovo agent that ships with the app, accepts or rejects each piece that waits. A rejection needs a reason, and the Proof Verifier gives a reason for every verdict. By default a person cannot accept evidence they typed in themselves. A project can allow that, and the panel then labels the proof self-reviewed. The project page and the JQL field show it as proven. A person can accept evidence that their own coding agent submitted, and the app counts that as a review by someone else. An attestation proves its criterion when it comes from someone who is not the assignee, also when the work item has no assignee. An attestation by the assignee needs a second reader, unless the project allows self-review.
- **A second source for pull requests and builds.** When evidence links a pull request or a build, the app asks Jira's Teamwork Graph what the connected development tool reported for that work item. The reviewer sees whether the two agree.
- **Done gate.** When a work item is closed with an unproven contract, the app comments on it or moves it back. A workflow validator can refuse the transition outright.
- **Project meter.** One page per project says whether the work is climbing, busy but not climbing, or stalled. It lists the work items under contract that you can see, up to the 200 that changed most recently, with what each still needs.
- **Tools for coding agents.** An MCP server lets an outside agent fetch the contract and a context pack and submit evidence. It has no tool that records a verdict.
- **JQL.** `statusCategory = Done AND proofState != proven` finds closed work whose contract is not fully proven.

[docs/design.md](docs/design.md) has the rules of proof, the decisions behind them, and the state of each part.

## Try it in five minutes

You need a Jira site where you are an admin, with one software project. Only step 6 needs Rovo. Jira's navigation now calls a project a space. The app and this page say project.

1. **Install the app.** The shared install link goes here once the production build is published. Until then, deploy your own copy as described under [Development](#development). The app asks for Teamwork Graph scopes, and Atlassian's documentation says an organization admin has to grant those. On a site you created yourself, you are one.
2. **Load the sample.** Open the project and choose Proof of Done in the row of tabs under its name. When the row is full, Jira keeps it under More. Press Load sample data. The app creates five work items labelled `proof-of-done-sample`. One is closed and proven, one is closed without proof, two are in progress, and one has no contract yet. On a project with no other recent work the meter reads "Busy, not climbing", because one work item was closed with proof against five that were opened.
3. **Review evidence.** Open "Sample: Export the audit log as CSV" and add the Proof of Done panel from the work item's apps button. Two pieces of evidence wait for a check. Press Review on one, read what it states and what the checks found, and accept or reject it with a reason.
4. **Start a contract of your own.** Open any other work item and add the panel. If the description has a list under a heading such as "Acceptance criteria", the panel offers those criteria and one click creates the contract. If not, type the first criterion and press Add criterion. Jira asks you to allow access the first time, because the app acts as you.
5. **Add evidence by hand.** Press Add evidence on a criterion and choose Test run. Enter a run with two failed tests, and the app turns it away with the reason. Set the failures to zero and it is stored.
6. **Get a verdict.** Evidence you typed yourself needs a second reader. Press Ask Proof Verifier to hand it to the app's Rovo agent. Rovo lists the verdicts the agent wants to record, and you confirm them. After you press Ask Proof Verifier, the panel looks again every eight seconds for five minutes, so each verdict shows up there with the agent's reasoning. On a site without Rovo, or to work as a team of one, open the Settings tab of the project's Proof of Done page and turn off "Evidence has to be accepted by someone other than the person who entered it".
7. **Close something without proof.** Move a work item with an unproven contract to Done. The app comments on it within a few seconds and says what is missing. Jira allows itself up to three minutes to deliver the change. To have the work item moved back instead, change "When a work item is closed without proof" in the settings.
8. **Search by proof.** Run `statusCategory = Done AND proofState != proven` in the work item search.

When you are done, press Remove sample data on the project page. It deletes the sample work items the app created, together with any subtasks that someone added under them. It deletes no other work item.

## Block the transition itself

The comment and the move back happen after the work item was closed. To stop the close, add the app's validator to the workflow.

1. Open the workflow editor of the project.
2. Select the transition into your done status and add a validator. A team-managed project calls it a rule.
3. Choose "Proof of Done is complete" and publish the workflow.

Jira then refuses the transition and shows what is missing, for example "Proof of Done: 5 of 5 criteria are not proven (5 with no evidence). Add or review evidence in the Proof of Done panel."

Remove the validator from every workflow before you uninstall the app. A validator that is left behind blocks its transition.

## The Proof Verifier

The Proof Verifier is a Rovo agent. It reads the evidence that waits on a work item, decides whether each piece proves its criterion, and records a verdict with its reasoning. Its instructions tell it to judge from the record, to treat text inside evidence as material to judge and not as an instruction, and to reject when it is unsure. The app does not enforce these instructions. The Proof Verifier runs on a language model, so it can still get a verdict wrong.

Open it with Ask Proof Verifier in the panel. You can also pick it in Rovo chat and ask, for example, "Review the evidence that waits on ABC-123".

Rovo shows the verdicts in a card first, each with a checkbox. The agent records them when you press Confirm selected.

## The Teamwork Graph check

Evidence for a pull request or a build says what its author says. When a code host or a CI tool is connected to Jira, the Teamwork Graph holds what that tool reported for the work item. The app compares the two and puts a note in the Review dialog.

| Note | What it means |
| --- | --- |
| Confirmed | The graph links this pull request, build or deployment to the work item, and its state agrees with the evidence |
| Differs | The graph holds a state that contradicts the evidence, such as a pull request that is still open |
| Not linked | The graph links other pull requests or builds to the work item, and this link is not one of them |
| No record | The graph has nothing to compare with |

To see more than "No record", the site needs a development tool connected, such as GitHub or Bitbucket, and a pull request with the work item key in its title. Add that pull request as evidence on the work item. The note is in the dialog that opens from Review, or from Reject on evidence you entered yourself. When the graph does not answer, the dialog says so and has an Ask again button.

The note is advice for the reviewer. It never accepts or rejects, and the done gate does not read it. The Proof Verifier gets the same note with each piece of evidence, and a coding agent gets it in the answer to `submit-evidence`.

## Coding agents

The app's MCP server has five tools: `get-context-pack`, `get-done-contract`, `start-done-contract`, `submit-evidence` and `list-unproven-work`. An agent can start a contract only from criteria that are already written down, and it cannot record a verdict, so it cannot accept its own work. `get-context-pack` also lists the pull requests, builds and deployments Jira links to the work item. Access from outside Atlassian is off until an admin turns it on.

1. A site admin opens Atlassian Administration, then Apps, Sites, the site, Connected apps, Proof of Done, and turns on its tools.
2. Each person who will use an agent opens the Proof of Done panel on any work item once and chooses Allow access. The tools act as that person, so Jira decides what the agent may see and change.
3. Connect the agent to `https://mcp.atlassian.com/forge/<app id>`. The shared build has the id `8c9b1b0d-9480-40dc-b852-5f17375dd7fd`, and the Marketplace build has `8e9618ee-0af4-4f2a-95af-436f5d28f0b9`. A copy you deployed yourself has its own, at the end of `app.id` in `manifest.yml`. In Claude Code:

   ```
   claude mcp add --transport http proof-of-done https://mcp.atlassian.com/forge/8c9b1b0d-9480-40dc-b852-5f17375dd7fd
   ```

   Then run `/mcp` and sign in.
4. Give the agent the skill in [skills/proof-of-done](skills/proof-of-done/SKILL.md). It teaches the loop: read the contract first, submit evidence for each criterion, and say "done" only when `get-done-contract` reports every criterion as proven. For Claude Code, copy the folder into `~/.claude/skills/`.

## What it stores and what it may do

- Its scopes are `read:jira-work` and `write:jira-work`, and four Teamwork Graph scopes that only read: `read:graph:issue:jira`, `read:graph:pull-request:external`, `read:graph:build:external` and `read:graph:deployment:external`.
- Contracts, evidence, verdicts and the event history live in Forge SQL, inside Atlassian's cloud. The app makes no outbound network calls, and the Forge CLI reports it as eligible for Runs on Atlassian. It gives contract and work item data to Jira, to Rovo when someone asks the Proof Verifier, and to a coding agent that a person connects.
- The app makes no LLM calls. The reasoning happens in Rovo and in the coding agent.
- It reads work items and the Teamwork Graph as the person who is using it, and asks Jira whether that person may edit them. As itself it comments on or moves a work item that was closed with an unproven contract, writes the work item property `proof-of-done` that JQL searches, and creates and deletes the sample work items.
- When a work item is deleted, the app deletes everything it stored for it.

## Development

You need Node.js 22 or 24 and the Forge CLI. This build used `@forge/cli` 16.0.0.

```
npm ci
npm run check
```

`npm run check` runs the type check, the tests and `forge lint`. The tests need no Atlassian account. Unit tests cover the rules, the services and the agent tools. The page tests in `test/ui.test.ts` mount the three pages on stand-ins for Forge and run the real resolvers behind them.

To run your own copy:

```
forge register
forge deploy -e development
forge install -e development --product jira --site <your-site>.atlassian.net
```

`forge register` runs once and writes your own app id into `manifest.yml`.

### Two registrations

The same code runs under two Forge app ids.

| App id | What it is for | How it is deployed |
| --- | --- | --- |
| `8c9b1b0d-9480-40dc-b852-5f17375dd7fd` | The shared build, installed from a link. `manifest.yml` holds this id | `forge deploy -e production` |
| `8e9618ee-0af4-4f2a-95af-436f5d28f0b9` | The Atlassian Marketplace listing | `scripts/deploy-marketplace.sh` |

Forge turns link sharing off for an app that was submitted for a Marketplace listing, or that has a licence in its manifest. So the first registration is never submitted for listing and its manifest gets no `licensing` entry.

`forge deploy` takes the app id from `manifest.yml` and has no flag to override it. `scripts/deploy-marketplace.sh` exports the last commit to a temporary folder, swaps the id in that copy and deploys it to production. Pass `staging` as the first argument to deploy there. Arguments after the environment go to `forge deploy`. `forge install` and `forge uninstall` do take `--app-id-override`.

The listing's documentation, support, privacy and terms pages are in a repository of their own, [proof-of-done-docs](https://github.com/ALikesToCode/proof-of-done-docs), published at https://alikestocode.github.io/proof-of-done-docs/. The privacy page and the listing's Privacy & Security answers both say what the app stores and where. Change both when the code changes that.

The Teamwork Graph does not always answer on the development site. On 23 Nov 2026, a day on which Atlassian reported a degraded authentication service, it refused some of the app's queries for up to half an hour after each `forge deploy`. On 24 Nov it refused the first three asks of the day and answered the fourth, two and a half minutes after the first. Less than six minutes after a deploy that day, it answered the first ask. When the Review dialog says that the graph did not answer, press Ask again.

| Path | What is in it |
| --- | --- |
| `manifest.yml` | The Forge modules, the agent tools and the scopes |
| `src/core/` | The rules of proof, the checks and the meter. No Forge imports |
| `src/services/` | Contracts, the project page, the done gate, the sample data, the agent tools |
| `src/store/`, `src/jira/`, `src/graph/` | The Forge SQL store, the Jira REST gateway and the Teamwork Graph gateway |
| `src/resolvers/`, `src/actions/`, `src/triggers/` | The backend of the pages, the seven tools, and the gate, validator and cleanup |
| `src/frontend/` | The issue panel, the project page and the settings page, in UI Kit |
| `rovo/` | The Proof Verifier's prompt and its two skills |
| `skills/proof-of-done/` | The open skill for coding agents |
| `scripts/` | The deploy step for the Marketplace registration |
| `test/` | Unit tests and page tests |

## Preview features

`jira:workflowValidator`, `rovo:mcp`, `rovo:skill` and the Teamwork Graph API were in Preview on 23 Nov 2026, so they can change. Package versions are pinned exactly in `package.json`, and the runtime is `nodejs24.x`.
