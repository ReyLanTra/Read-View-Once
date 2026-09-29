# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` (latest) | ✅ |
| Older commits / forks | ⚠️ best-effort only |

Security fixes land on `main`. Keep your clone updated (`git pull`) and
reinstall dependencies periodically (`npm install`) to receive Baileys patches.

## Reporting a Vulnerability

**Do NOT open a public issue** for security problems (session hijack, auth
bypass, remote code execution, credential leak, etc.).

Instead, contact the maintainer privately:

- GitHub: [@ReyLanTra](https://github.com/ReyLanTra) (open a minimal
  "[SECURITY]" issue **without** exploit details and ask for a private channel,
  or reach out via a profile-listed contact)

Include:

1. Description + impact.
2. Steps to reproduce (minimal).
3. Affected commit / version.
4. Suggested fix, if any.

You will get an initial response within **7 days**. Valid reports are fixed
ASAP and credited (unless you prefer anonymity).

## Handling Secrets

This project deals with sensitive material by nature:

- `session/` holds WhatsApp credentials — **never** commit, share, or paste
  it anywhere. It is already in `.gitignore`.
- `logs.txt` contains sender names/numbers — **redact** before sharing.
- When reporting bugs, replace real numbers (`62812xxxx`) and use `...`.

## Scope Notes

- This bot re-sends view-once media the **linked account can already see**.
  Only use it for media you have the right to open; do not use it to harvest
  or redistribute others' private media.
- Out of scope: vulnerabilities in WhatsApp itself, Baileys upstream, or the
  user's device/network.
