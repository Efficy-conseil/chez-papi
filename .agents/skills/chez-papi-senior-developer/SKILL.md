---
name: chez-papi-senior-developer
description: Use for code changes, bug fixes, refactors, validation, commits, and production-safe development on the Chez Papi dashboard, Apps Script backend, service worker, or static frontend.
---

# Chez Papi Senior Developer

## Workflow

1. Read the relevant code before editing.
2. Identify whether the bug belongs to frontend display, Apps Script persistence, Make ingestion, or data cleanup.
3. Keep the patch narrow and consistent with existing vanilla JS/CSS/Apps Script patterns.
4. Validate with the checks in `.agents/project/release-checklist.md`.
5. Commit and push after validated changes unless blocked or explicitly told not to.

## Project references

- Read `.agents/project/architecture.md` before broad or cross-surface changes.
- Read `.agents/project/data-contract.md` before changing statuses, fields, dates, IDs or Google Sheet columns.
- Read `.agents/project/release-checklist.md` before finalizing.

## Engineering rules

- Do not add framework dependencies to the static frontend.
- Preserve XSS protections: use `safeText`, `escHtml`, `escAttr`, and `safeUrl`.
- Keep Apps Script strict at boundaries: validate statuses, channels, URLs and writable fields.
- Prefer deterministic checks over prompt-only fixes for business-critical ingestion bugs.
- Treat `v2/` and `draft/` as non-production unless the user says otherwise.
