# Gemini CLI Assistant Agents

This repository hosts an experimental community extension for Gemini CLI. It provides three task-focused MCP tools plus a maintenance helper you can call from any Gemini CLI session.

## Available tools
- `search_gemini_docs`
- `configure_gemini_cli`
- `query_gemini_config`
- `update_gemini_docs`

Each tool is described for agents inside `GEMINI.md`, which Gemini CLI automatically loads whenever the extension is active.

## Refreshing documentation
The `/updatedocs` command fetches the latest Gemini CLI docs (via `llms.txt`) and the upstream README, then rebuilds the local search index. This keeps agent answers in sync with the canonical documentation.

## Versioning policy
- Patch versions (1.0.x) bump whenever we change doc content, add tools, or otherwise alter behaviour.
- Update `package.json` and `gemini-extension.json` together so agents report the correct version.
- After bumping the version, rebuild the project (`npm run build:all`) and relink it inside Gemini CLI before testing.

## Testing reminders
1. Run `npm run build:docs` and `npm run build`.
2. Relink with `gemini extensions link .`.
3. Within Gemini CLI, run `/updatedocs` once to confirm the cache refresh succeeds.

Future agents should follow this flow before demos or releases so the CLI has the freshest instructions and correct version metadata.
