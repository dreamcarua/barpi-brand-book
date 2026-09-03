# Barpi Brand Book

Barpi (barpi.com.ua) — natural vacuum-dried snacks for dogs and cats made on snEco's own patented technology; the youngest project of the group, currently growing on the Ukrainian market before international expansion.
This repo is the Brand Bible site on GitHub Pages (static HTML, one folder per chapter) plus gated dashboards (sales-performance, financial, production, inventory, customer-360, partners, events, knowledge) fed by Cloudflare Workers and D1. Public repository — see Rules.
Memory carrier: `github.com/dreamcarua/barpi-brand-book` (this repo). `docs/` is the project's memory; this file is its index.
Project hub: `github.com/dreamcarua/barpi-memory` — project-level memory (strategy, marketing, sales, partnerships, people). This repo's `docs/` is about this codebase only.
Owner: Vadym Hryshyn (vg@abrisart.com). Tasks are closed by whoever set them; we hand over.

## Rules

- Talk to the user in Ukrainian (or the language they write in). Dates DD.MM.YYYY, time CET/CEST. Structured, no filler.
- Do on your own: content and code edits, workflow edits, branches, commits, pull requests, reads from D1 through the API worker.
- Always ask first: money; deploying a worker to production; rotating any key; DELETE/UPDATE straight in D1; repository visibility; editing anything inside MoySklad; history rewrite (`bfg`).
- Never: put a secret value, token, chat id, host, IP or personal phone number into a file — this repository is PUBLIC. Write "see SECURITY.md / password manager" instead.
- Never: NASA, "космічні технології" or space visuals as the description of how the product is made. It is snEco's own patented low-temperature vacuum drying (34–38°C). Also banned in copy: "лікує", "найкращі", medical promises, "купуйте терміново", "м'ясні смаколики" (there is a cheese line too), "мікрохвильова сушка" in B2C.
- Brand canon is not changed without the owner: "Турбота для справжніх друзів", "Один інгредієнт. Без зайвого.", Rubik + Qanelas Soft, #001154 / #BAD9F4, founders Vadym and Pylyp Hryshyn plus COO Oleksandr Aksonov, transliteration Hryshyn (not Gryshyn), Pylyp (not Filip).
- MoySklad is the source of truth for products and sales. Never hand-edit rows in D1: the hourly sync overwrites them (`docs/architecture.md`).
- Secrets never go into this repo. `docs/tooling.md` says where they live, not what they are.

## Entry — before the first action that changes project state

Chat without a folder? Nothing was loaded automatically: fetch this file and `docs/` from the carrier first.

1. `docs/tasks.md` — what is open, what is handed over and waiting, where the next move is ours.
2. `docs/handoff.md` — not empty means a previous session stopped mid-task. Continue, do not restart.
3. `docs/traps.md` — before the first edit of code, HTML, worker or workflow. Always.
4. `docs/tooling.md` — before using any tool, MCP, worker, database or account of this project.
5. Recent commits — the `barpi-bot` identity commits from workflows (og-image, apply-patch); a human commit in the last hours means someone else is working here.
6. Related carriers (below) — the task touches another repository of this project, or knowledge that lives at project level (market, partners, people, money): fetch its `AGENTS.md` and `tasks.md` too, before deciding anything.

Say one sentence: how many tasks are open, which are on us, what you start with. If a move is ours, say that first, even if asked about something else.

A task you were just given goes into `docs/tasks.md` now, verbatim, with the author's name. Before starting it, check it is not already done in the code.

## Context loss — when you can no longer quote the original task verbatim

You detect this yourself; nobody will tell you. Your context was compacted. Before the next action re-read `docs/handoff.md` and `docs/tasks.md`. Do not trust the summary for paths, numbers or what is already done; re-read the file.

## Checkpoint — during long tasks

Automatic. The user never asks for a checkpoint and is never reminded to.

After each completed step of a multi-step task and before any long operation: rewrite `docs/handoff.md` (task verbatim, done, not done, next action, numbers with sources). Rewrite, do not append. Empty it when the task is handed over.

## Pre-flight — before an irreversible action, money, or a shared resource

Answer out loud in the reply. No answer to a line = no action.

1. WHOSE. Who else changes this? Are there commits in the last hours that are not mine? Is the live worker newer than the repo copy?
2. SOURCE. Number · source · date. Primary source (MoySklad, Cloudflare dashboard, D1) or a convenient sample (one dashboard card, one page of rows)?
3. WHOLE. The population or the first N rows? Did I ask the system for the total?
4. WORST. Which single check, if it came out differently, would cancel this? Do it first.
5. ROLLBACK. Exact command. Backup made and verified (D1 Time Travel, R2 weekly dump, worker backup file).

## Exit — automatic, before the word "done"

You run this unasked, every time a task changed project state — the user does not say "Exit" and does not remember these files exist. Also run it when the user says the task is finished, changes subject, or leaves; a task interrupted mid-way gets a Checkpoint instead.

1. What did I learn about this project? → `docs/traps.md`, `docs/tooling.md`
   Learned about the business rather than this codebase (market, a retail chain, a partner, a decision of the owner's) → the project hub `dreamcarua/barpi-memory`, via the GitHub tool, not here. One fact lives in one place.
2. What did I decide and why? → `docs/decisions.md`
3. What is left open, including side findings nobody asked for? → `docs/tasks.md`
4. Can the owner see the result without effort? If not: link to the live page, screenshot or PR with the handover.
5. Report through the project channel → `docs/tooling.md` → Reporting.

Records go in the same commit as the change. Hand over now, in this reply. A line leaves `tasks.md` when its author confirms, not when the work is done.
Two people ask for opposite things: pick one, name the conflict, tell Vadym.

## Map

| File | What | Read when |
|---|---|---|
| `docs/tasks.md` | open tasks, handed-over-and-waiting | entry. Always |
| `docs/handoff.md` | mid-task state of the last session | entry; after context loss |
| `docs/traps.md` | traps of this project | before the first edit. Always |
| `docs/tooling.md` | tools, access, secret names, entry patterns, reporting | before using any tool |
| `docs/architecture.md` | sources of truth, what overwrites what, trigger channels, logs | before touching D1, the sync or a dashboard |
| `docs/decisions.md` | why it is this way | before changing something already agreed |
| `docs/personal.md` | who asks for what, who accepts, who arbitrates | before promising or handing over |
| `docs/open-questions.md` | blocked until a human decides | before talking about plans |
| `docs/changelog.md` | changes made outside git | after any change outside git |
| `docs/archive/CLAUDE.md.03.09.2026.md` | previous `CLAUDE.md` verbatim (brand facts, legal, SKU list, Cloudflare/Supabase ids) | when you need brand or legal detail not repeated here |
| `RUNBOOK.md` | 9 operational procedures with real URLs and commands | deploy, sync failure, backup, CF Access, GDPR |
| `SECURITY.md` | secrets inventory, rotation, leak response, auth flow | before touching any credential |
| `PRIORITIZED_BACKLOG.md`, `BACKLOG.md`, `AUDIT_REPORT_2026-06-12.md` | audit findings and their status | when picking up technical debt |

## Related carriers — the same project, other repositories

| Carrier | What it is | Read its `AGENTS.md` + `tasks.md` when |
|---|---|---|
| `github.com/dreamcarua/barpi-memory` | project hub: strategy, marketing, sales, partnerships, people, business decisions | the task goes beyond this codebase — market, chains, partners, money, headcount |

A task that spans two carriers: one line in each `tasks.md`, each pointing at the other.

## Overrides of global rules

| Global rule | Here | Why | Since |
|---|---|---|---|
| "commit straight to `main` in `dreamcarua/*`" | memory and structural changes go to a branch; `main` only for content fixes | the repo is public and auto-deploys to brand.barpi.ua on every push to `main` | 03.09.2026 |
