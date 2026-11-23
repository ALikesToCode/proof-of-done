---
name: report-proof
description: Report where the proof of a Jira work item or a whole project stands under Proof of Done. Use when someone asks what is still unproven, whether a work item can close, which work was closed without proof, or whether a project is climbing, busy or stalled.
allowed-tools: get-done-contract list-unproven-work
---

# Report proof

Every number and state in the report comes from a tool answer in this conversation.

## One work item

1. Call `get-done-contract` with the key in the request, or for the work item the person has open.
2. When `hasContract` is false, say that the work item has no done contract and that a person can create one in the Proof of Done panel. Stop there.
3. Report in this order.
   - How many criteria are proven, as `proof.proven` of `proof.total`, and whether the work item may close, from `gate.passes` and `gate.reason`.
   - Each criterion that is not `proven`, with its `state` in plain words. For `rejected` evidence give the verdict's `reason`. For `failed_checks` give the `problems`.
   - An offer to review, when any evidence is `waiting_for_review`.

The `next` lines in the answer are written for the agent that does the work. Report them as what the work still needs.

## A project

1. Call `list-unproven-work` with the project key, or for the project the person has open. Pass `windowDays` as 14 or 30 when the person names that window. The default is 7.
2. Report in this order.
   - The meter. `climbing` means more work closed with proof than arrived. `busy` means there was activity and proven closures did not outrun new and reopened work. `stalled` means nothing happened. Give `meter.reason` with it.
   - The counts in `contracts`. When `closedWithoutProof` is above zero, say "closed without proof" in those words.
   - The work items as a short list with the key, the summary, `proof` and `note`. They arrive most urgent first, so keep the order.
   - The number in `more`, when present, as work items not listed.

## Tool errors

An answer with `ok: false` carries a `code` and an `error` sentence. Give the person the sentence as written and stop.
