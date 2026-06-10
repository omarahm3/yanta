# Issue triage

YANTA's backlog is goal-driven. **Every issue carries exactly one `goal:*` label.**
A goalless issue is an un-triaged issue — it never sits in the backlog quietly.

## Goals → labels

Each goal traces to YANTA's product strategy. Pick the closest one.

| Label | Goal | Covers |
| --- | --- | --- |
| `goal:G1-reliability` | G1 · Reliability & data-safety | Vault read/write, atomic saves, search index, never lose a note |
| `goal:G2-onboarding` | G2 · Onboarding & usability | First-run, discoverability, keyboard flows, getting productive fast |
| `goal:G3-polish` | G3 · UI/UX polish | Spacing, motion, theming, empty states, micro-interactions |
| `goal:G4-distribution` | G4 · Distribution & release | Packaging, signing, auto-update, installers, release pipeline |
| `goal:G5-growth` | G5 · Growth & maintenance | Docs, infra, CI, housekeeping, developer experience |

The label set is defined in [`.github/labels.yml`](./labels.yml) (the recoverable
source of truth) and applied with [`scripts/sync-labels.sh`](../scripts/sync-labels.sh).

## The triage rule

> Every new issue gets a goal label within one heartbeat, or it is flagged for the CEO.

This is enforced structurally so it does not depend on anyone remembering:

1. **Blank issues are disabled.** New issues must use a template
   ([`bug_report`](./ISSUE_TEMPLATE/bug_report.yml) /
   [`feature_request`](./ISSUE_TEMPLATE/feature_request.yml)), each of which asks
   for the goal up front and applies the `needs-goal` flag on creation.
2. **The [triage workflow](./workflows/triage-goal-label.yml) backstops it.** On
   every issue open/edit/label change it checks for a `goal:*` label:
   - has one → it removes `needs-goal` and stays silent;
   - has none → it (re)applies `needs-goal` and pings the CEO once to assign a goal.

So an issue is either correctly goal-labelled, or visibly carrying `needs-goal`
with the CEO flagged. Nothing sits goalless and unnoticed.

## Day-to-day

- **Filing an issue:** use a template, pick the goal. Done.
- **Triaging:** filter the backlog by `label:needs-goal`, add the right `goal:*`
  label (the flag clears itself), or close the issue if it is out of scope.
- **Changing the goal set:** edit `.github/labels.yml`, update this doc and the
  template dropdowns, then run `scripts/sync-labels.sh`.
