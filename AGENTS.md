# Revyme development instructions

Use this file as the shared starting point for Codex, Claude Code, and other coding agents working on this checkout. If your client does not load project instructions automatically, read this file explicitly before working. Follow more specific instructions in the directories you change.

## Before changing anything

- Confirm the task, repository, and active branch. Check `git status --short --branch` and the relevant diff. Preserve existing user edits and generated project data; don't reset, clean, or overwrite unrelated work.
- Use [README.md](README.md) for the product and local setup, [CLAUDE.md](CLAUDE.md) for architecture and invariants, and [CONTRIBUTING.md](CONTRIBUTING.md) for code review and verification. Read [e2e/README.md](e2e/README.md) for browser-test work. Read the architecture guide as a reference; skip reprocessing its import of this file.
- Check current code and configuration when examples or comments disagree. Scope changes to the task and use existing patterns and helpers.
- `origin` is the working fork; `upstream` is the original project. Verify the destination before any remote write. Don't commit, push, deploy, or modify remote settings unless requested. A push to `main` may trigger the fork's configured workflows.

## Develop and test locally

- Match CI's Node.js 24 environment when practical. For a fresh checkout, install with `npm ci`. It replaces `node_modules`; don't run it just to inspect a working checkout.
- `npm run dev` starts the editor on 3333, canvas sandbox on 5174, and preview on 5175. Prefer standalone mode for local development. Keep `VITE_REVYME_CLOUD` unset or empty for a normal local run; the current cloud gate requires the exact string `true`. Playwright config sets local mode and isolates the AI endpoint.
- Standalone projects live in browser storage. Use a disposable browser context and fixture project for tests; don't clear browser storage or experiment on the user's real project.
- Start with the checks that exercise your change. For application changes, use `npx tsc --noEmit`, `npm run test:run`, `npm run lint`, and `npm run build:all` as applicable. Run relevant Playwright specs for canvas, interaction, and rendering changes. Report checks run and any failures or gaps; docs-only changes need Markdown/link and diff checks.

## Preserve editor behavior

- JSX is the project document. Durable edits must survive parsing, generation, rendering, and undo/redo. Use the mutation queue and the appropriate generator. Use `modifyProjectFile()` for read-modify-write operations; raw read/transform/write can discard queued edits.
- Use the canvas bridge and `src/canvas/node-ops.ts` for cross-frame DOM and layout work. Keep the canvas and plugin isolation boundaries intact.
- Preserve node IDs, viewport and component variant behavior, empty-string style removal, and one undo step per user action. For structural edits that can't be patched in place, follow the caller-side `flushAndForceStructuralRender()` pattern in the contributor guide.
- Keep the oracle checks on agent-authored project files. Preserve diagnostic traces and add useful traces for new behavior without logging credentials or private content. Keep runtime behavior needed by exported sites in the documented `@revyme/runtime` boundary.

## AI tools and handoffs

- A coding agent working on this repository is separate from Revyme's in-editor Vibe and MCP services. [.env.example](.env.example) documents those service settings; the checkout does not supply the compatible AI backend. Do not enable cloud mode or point a local project at a hosted service as a shortcut.
- Keep credentials out of committed files, browser-exposed environment values, and logs. Keep repository guidance portable across agents and machines. Preserve [NOTICE](NOTICE) and existing attributions.
- When handing off to another agent, record the task, branch and commit, relevant paths, pre-existing changes, what you verified, and the next concrete step. Do not treat a handoff as authorization to publish or deploy.
