# Security

## Reporting a vulnerability

Please don't open a public issue for a security problem. Use GitHub's private vulnerability reporting on this repository (Security → Report a vulnerability), or contact a maintainer directly. Say what is affected, how to reproduce it and what an attacker could do. We'll acknowledge the report and keep you updated while it is fixed.

## Before using real evidence

Evidentia is a hackathon build. It is not ready to hold real case data:

- **No authentication.** The investigator chosen in the header is sent as an `X-Investigator-Id` header and recorded in the audit log, but nothing checks it. Anyone who can reach the API can read and change every case. Access control is planned (milestone M8 in [docs/PLAN.md](docs/PLAN.md)).
- **The audit trail and chain of custody are not tamper-proof.** The application only ever adds custody events and never edits them, but anyone with direct access to the database or `storage/` can change both. A matching hash shows a file's bytes are unchanged since registration; it doesn't prove the evidence is authentic.
- **Local storage.** Originals sit unencrypted under `storage/`, and the database is a local SQLite file.
- **Third-party AI.** With `GEMINI_API_KEY` set, evidence text, images and audio are sent to Google's Gemini API. Check that your data-handling rules allow it before uploading anything sensitive.
- **Map tiles** are fetched from Esri, OpenStreetMap and, optionally, Cesium ion, which reveals the areas being viewed to those services.

Run it only on a trusted machine or network, with invented or properly cleared data.

## Secrets

Keep API keys in the root `.env`, which git ignores. Never commit `.env` or `storage/`. If a key is committed by mistake, revoke it with its provider first, then remove it from the history.
