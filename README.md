# Playwright form autofill agent (preview)

Proof of concept: an AI agent fills a local job application form with
[Playwright](https://playwright.dev), from a fake profile. The agent only sees
`OK` / `UNKNOWN` per field, never the profile values.

The agent (`.claude/agents/form-filler.md`) runs in GitHub Copilot (VS Code)
and in Claude Code.

## Setup

```bash
npm ci
npx playwright install --with-deps
```

## Run with the agent

In GitHub Copilot or Claude Code, open this folder and ask:

> Fill the application form.

The `form-filler` agent fills the form one field per second, submits it,
reports, then asks before closing the window.

## Run without an agent

Run the same commands yourself:

```bash
node scripts/fill_cli.mts --delay-ms 1000 --submit   # fill and submit, then wait
node scripts/close_cli.mts                           # in another terminal: close the window
```

## Tests

```bash
npx playwright test
npx playwright test --ui
```

## Notes

- Set up with the Playwright Test for VSCode extension (generated config,
  example test and workflow kept as is).
- Submitting is only allowed on a local file form.
- Preview: tested on the local form only.
