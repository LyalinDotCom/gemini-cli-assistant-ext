# Gemini CLI Assistant MCP Server

Experimental community project that gives Gemini CLI a helper MCP server. It is not an official Google product.

## What you get
- `search_gemini_docs`: search Gemini CLI documentation from a local copy of `https://geminicli.com/llms.txt`
- `configure_gemini_cli`: change Gemini CLI settings using natural-language instructions
- `query_gemini_config`: inspect current Gemini CLI settings without editing them

## Install as a Gemini CLI extension
```bash
npm install
npm run build:all
gemini extensions link .
```
Restart Gemini CLI and the extension loads automatically.

## Manual MCP registration
If you cannot use extensions, add the server directly:
```json
{
  "mcpServers": {
    "gemini-assistant": {
      "command": "node",
      "args": ["/absolute/path/to/gemini-cli-assistant-ext/dist/server.js"],
      "trust": true
    }
  }
}
```

## Refreshing documentation
`npm run build:docs` downloads the latest `llms.txt`, stores it in `docs/`, and rebuilds the search index with `geminicli.com/docs` links. Run it whenever you want newer documentation before rebuilding the TypeScript server.

## Development notes
- Requires Node.js 20+
- `npm run build` compiles the server
- `npm run build:all` runs the documentation sync then the TypeScript build
- `npm run dev` and `npm test` remain available for iterative work

## About this project
Maintained by the community for experimentation around Gemini CLI tooling. Feedback and fixes are welcome.
