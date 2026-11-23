---
name: proof-of-done
description: Prove Jira work before reporting it done, through the Proof of Done MCP tools. Use when you are given a Jira work item to implement, fix or finish, or asked what a work item still needs before it can close.
compatibility: Needs the Proof of Done app on the Jira site and its MCP server connected to this agent.
---

# Proof of Done

A Jira work item under Proof of Done has a done contract, which is a list of criteria. A criterion is proven when you submit evidence for it and someone else accepts that evidence. The work is done when every criterion is proven, and your report says "done" only then.

## The loop

1. **Read the contract before anything else.** Call `get-context-pack` with the work item key. It returns the description, the parent, linked work, recent comments, the `contract`, and the `rules` of proof in this project. `development`, when present, lists the pull requests, builds and deployments Jira already links to the work item.
   - When `contract.hasContract` is false and `contract.suggested` lists criteria, call `start-done-contract`.
   - When there is no contract and nothing is suggested, the work cannot be proven yet. Ask the person to write the contract in the Proof of Done panel.
2. **Plan against the criteria.** Each criterion has an `id`, its `text`, and `needs`, the kind of evidence it takes. Decide how you will prove each one before you start.
3. **Do the work.** Put the work item key in the branch name, the pull request title or a commit message, as in `ABC-123-lock-accounts`. A code host connected to Jira then links your pull request and its builds to the work item, and the reviewer sees Jira confirm them.
4. **Submit evidence one criterion at a time.** Call `submit-evidence` as soon as a criterion is met, with what you observed in this session.
5. **Read the answer.** `passedChecks: false` means the app turned the evidence away, and `problems` says why. Fix the cause and submit again. `passedChecks: true` means the evidence now waits for a review. A `graph` line says what Jira's Teamwork Graph holds about your pull request or build. The reviewer gets the same line, read again when they review. Where it contradicts your evidence, submit evidence that states what is true now. Where it says Jira does not link the pull request or build to the work item, `next` says how to get it linked.
6. **Check the contract.** Call `get-done-contract`. The loop is complete when every criterion is `proven` or `waiting_for_review`, or you have told the person which ones you cannot prove and why.
7. **Report the state the contract shows.** Give the count of proven criteria, the ones that wait for a review, and the ones still open. Say "done" only when `gate.passes` is true.

Asked what is left in a whole project, call `list-unproven-work` with the project key. It lists the work items that are not proven, most urgent first, and says whether the project is climbing, busy or stalled.

## Evidence

Evidence records something you ran or made in this session. Copy its numbers from the output.

Every piece needs `criterionId`, `kind`, and a `summary` of one or two sentences on what it shows about that criterion. Add `agentName` so the team can see which agent sent it.

| `kind` | Send | The app turns it away when |
| --- | --- | --- |
| `test_run` | `passed` and `failed`, the `commit`, and an `excerpt` of the output that opens with the command, as in `$ npm test` | a test failed, no test passed, or a count is missing |
| `build` | `status` with the result, and a `url` or a `commit` | the result is not a pass, or the build has neither a link nor a commit |
| `pull_request` | `url` and `status`, such as `open` or `merged` | the link is missing or is not a pull request, or the pull request was closed without merging |
| `document` | `url` | there is no link |
| `other` | a `url`, or an `excerpt` that shows the result | it has neither |

A criterion whose `needs` names one kind takes only that kind. `any` takes every kind in the table.

Passing the checks earns a place in the review queue. The Proof Verifier cannot open links, so put what matters in the `summary` and the `excerpt`.

## What you leave to others

- **The verdict.** A person or the Proof Verifier accepts or rejects your evidence. Tell the person when evidence waits, so they can review it in the panel or ask the Proof Verifier in Rovo chat.
- **Attestations.** A criterion that needs an `attestation` is proven by a person's word. Ask them for it.
- **The contract.** A criterion that is wrong or cannot be met goes back to the person who gave you the work.
- **The status.** Leave the work item out of a done status until `gate.passes` is true. The done gate comments on work that is closed without proof, or moves it back.

## When a tool says no

An answer with `ok: false` has a `code` and an `error` sentence that says what to do. Act on the sentence.

- `needs_access` and `forbidden` need the person. Pass the sentence on.
- `not_found` from `submit-evidence` means the criterion id is wrong. Call `get-done-contract` for the ids.

## Connecting

The tools come from the Proof of Done MCP server at `https://mcp.atlassian.com/forge/8c9b1b0d-9480-40dc-b852-5f17375dd7fd`. Your client may show their names with a prefix.

- In Claude Code, run `claude mcp add --transport http proof-of-done https://mcp.atlassian.com/forge/8c9b1b0d-9480-40dc-b852-5f17375dd7fd`, then `/mcp` to sign in.
- A site admin has to turn the tools on first, under Atlassian Administration, Apps, Sites, the site, Connected apps, Proof of Done, Tools.
- The person you act for opens the Proof of Done panel on any work item once and chooses Allow access.
