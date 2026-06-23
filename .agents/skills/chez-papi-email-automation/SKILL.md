---
name: chez-papi-email-automation
description: Use for Gmail/Wix/Voxist/Tally Make blueprints, email classification, hors-scope errors, duplicate demand prevention, follow-up handling, Apps Script email update routes, and Google Sheet ingestion bugs.
---

# Chez Papi Email Automation

## Start here

Read `.agents/project/make-email-rules.md` and `.agents/project/data-contract.md`.

## Workflow

1. Determine whether the email is a new demand, a follow-up to an existing demand, or hors scope.
2. Inspect the Make route filters and prompt before changing frontend deduplication.
3. If the fix affects duplicate creation, add or verify an Apps Script guardrail.
4. Validate the blueprint JSON.
5. State clearly that Make changes require scenario update/reimport.

## Critical rules

- A modification of an existing quote is `is_followup=true`, not a new line.
- A new catering request inside an old thread can still be a new demand.
- `threadId` alone is not a reliable business key.
- Do not send a fresh acknowledgement email for quote follow-ups.
- Preserve the original client message enough for Manon to act on it.
