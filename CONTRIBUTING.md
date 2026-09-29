# Contributing to Read-View-Once

Thanks for stopping by! Contributions of any size are welcome — bug fixes,
docs, translations, new commands, tests.

## 🚀 Quick Start

```bash
git clone https://github.com/ReyLanTra/Read-View-Once.git
cd Read-View-Once
npm install
npm start
```

Requirements: **Node.js >= 20**.

## 🌿 Workflow

1. **Fork** this repo, then clone your fork.
2. Create a branch: `git checkout -b feat/my-feature` (or `fix/...`, `docs/...`).
3. Make focused changes — one PR, one purpose.
4. Verify: `node --check index.js` (and run the bot once if you touched logic).
5. Commit with a clear message:
   - `feat: add /rvo alias ...`
   - `fix: handle expired view-once ...`
   - `docs: update Termux steps ...`
6. Push and open a **Pull Request** against `main`, describing **what / why / how tested**.

## ✅ PR Checklist

- [ ] Code follows existing style (single-file, stdlib-first, short diff).
- [ ] No new dependency unless justified in the PR description.
- [ ] No secrets committed (`session/`, `logs.txt`, phone numbers).
- [ ] README updated if behavior or setup changed (both `README.md` and `README.id.md` when relevant).
- [ ] Tested locally (`npm start`, reply `/rvo` to a view-once message).

## 💡 Good First Issues

- Additional commands / aliases
- Anti-spam or per-number rate limiting
- Number whitelist / owner-only mode
- Docker Compose example
- Automated checks (lint / smoke test in CI)
- More translations

## 🐛 Bug Reports

Open an **Issue** with:

1. What you did (steps to reproduce).
2. What you expected vs. what happened.
3. Redacted `logs.txt` excerpt (remove personal numbers/names).
4. Environment: OS, `node -v`, install method (npm / Docker / Termux).

## 📝 Docs & Translations

- Keep `README.md` (English, default) and `README.id.md` (Indonesian) in sync.
- Fixing typos doesn't need an issue — open a PR directly.

## 📜 Ground Rules

- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Respect privacy: never share others' view-once media or session files in issues/PRs.
- Security issues → see [SECURITY.md](./SECURITY.md), never file them as public issues.
