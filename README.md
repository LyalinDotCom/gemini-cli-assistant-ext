# Gemini CLI Assistant MCP Server

Experimental community project that gives Gemini CLI a helper MCP server. It is not an official Google product.

## What you get
- `search_gemini_docs`: search Gemini CLI documentation from a local copy of `https://geminicli.com/llms.txt`
- `configure_gemini_cli`: change Gemini CLI settings using natural-language instructions
- `query_gemini_config`: inspect current Gemini CLI settings without editing them
- `update_gemini_docs`: refresh the cached documentation bundle (`llms.txt` + search index)

## Install as a Gemini CLI extension
```bash
npm install
npm run build
gemini extensions link .
```
Restart Gemini CLI and the extension loads automatically. The extension launches the MCP server with `npx -y github:LyalinDotCom/gemini-cli-assistant-ext mcp`, so the build step ensures the compiled output exists when the remote package is prepared.

## Manual MCP registration
If you cannot use extensions, add the server directly:
```json
{
  "mcpServers": {
    "gemini-cli-assistant": {
      "command": "npx",
      "args": [
        "-y",
        "github:LyalinDotCom/gemini-cli-assistant-ext",
        "mcp"
      ],
      "trust": true
    }
  }
}
```

## Refreshing documentation
`npm run build:docs` downloads the latest `llms.txt` plus the upstream Gemini CLI README, stores them in `docs/`, and rebuilds the search index with `geminicli.com/docs` links. Run it whenever you want newer documentation before rebuilding the TypeScript server. Inside Gemini CLI you can also run `/updatedocs` to trigger the same refresh without leaving the REPL. These steps are also executed automatically during `npm install` (via `prepare`) so the GitHub-driven `npx` install has a fresh index.

## Development notes
- Requires Node.js 20+
- `npm run build` compiles the server
- `npm run build:all` runs the documentation sync then the TypeScript build
- `npm run dev` and `npm test` remain available for iterative work

## About this project
Maintained by the community for experimentation around Gemini CLI tooling. Feedback and fixes are welcome.
