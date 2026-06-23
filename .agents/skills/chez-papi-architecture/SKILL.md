---
name: chez-papi-architecture
description: Use for architecture decisions, data flow design, Make/Google Sheets/Apps Script boundaries, idempotence, deployment strategy, and efficient solution design for the Chez Papi client project.
---

# Chez Papi Architecture

## Start here

Read `.agents/project/architecture.md` and `.agents/project/data-contract.md`.

## Decision criteria

- Prefer the smallest change that fixes the business failure at the source.
- Protect idempotence: retries and follow-ups must not create duplicate demands.
- Keep the Google Sheet as operational source of truth, but avoid putting business logic only in the frontend.
- Use Apps Script as the deterministic guardrail for writes and updates.
- Use Make prompts for extraction and classification, with examples for known failure cases.

## When proposing a design

Return:

- the current failure mode;
- the surface to change;
- the data contract impact;
- the validation plan;
- what still needs manual deployment outside GitHub.

## Avoid

- New infrastructure unless the current static/PWA + Apps Script + Make stack cannot satisfy the need.
- Hidden frontend-only corrections for ingestion errors.
- Broad rewrites of the dashboard without a migration plan.
