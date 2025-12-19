# ADR Claude Code Plugin Marketplace

Shared plugin marketplace for the AllDigitalRewards engineering team. This repository contains Claude Code plugins that help our team work more effectively with ADR services, APIs, and codebases.

## Quick Start for Team Members

### 1. Add the Marketplace

```bash
/plugin marketplace add alldigitalrewards/claude-plugins
```

### 2. Install Plugins

```bash
/plugin install adr-context@adr-main
```

Or use the interactive menu: `/plugin` → Browse Plugins

### 3. Enable in Your Prompts

Add `use adr context` to any prompt to get ADR-specific documentation and code examples.

---

## Team Installation Options

### Option A: Manual Install (Individual)

Each developer adds the marketplace and installs plugins themselves:

```bash
# Add marketplace
/plugin marketplace add alldigitalrewards/claude-plugins

# Install and enable
/plugin install adr-context@adr-main
```

### Option B: Project Configuration (Recommended for Repos)

Add to your project's `.claude/settings.json` to auto-install for everyone who clones the repo:

```json
{
  "extraKnownMarketplaces": {
    "adr-main": {
      "source": {
        "source": "github",
        "repo": "alldigitalrewards/claude-plugins"
      }
    }
  },
  "enabledPlugins": {
    "adr-context@adr-main": true
  }
}
```

When team members trust the project folder, plugins install automatically.

### Option C: User-Wide Configuration

Add to `~/.claude/settings.json` to have plugins available across all projects:

```json
{
  "extraKnownMarketplaces": {
    "adr-main": {
      "source": {
        "source": "github",
        "repo": "alldigitalrewards/claude-plugins"
      }
    }
  },
  "enabledPlugins": {
    "adr-context@adr-main": true
  }
}
```

---

## Available Plugins

### ADR Context (v2.0)

AI-powered documentation server that provides semantic search across ADR services, APIs, and code. Think of it as Context7 but for our internal services.

#### Features

- **Semantic Search** - Uses OpenAI embeddings to understand what you're looking for, not just keyword matching
- **Service Discovery** - Finds ADR services, APIs, and repos matching natural language queries
- **RAG-Enhanced Docs** - Retrieves the most relevant documentation and code examples
- **Natural Language Q&A** - Ask questions about ADR systems and get synthesized answers with code examples
- **Automatic Indexing** - Indexes Marketplace API endpoints, schemas, and org repositories on startup

#### Tools

| Tool | Description |
|------|-------------|
| `resolve-service-id` | Find ADR services by natural language query. Call this first. |
| `get-service-docs` | Fetch documentation for a service with optional topic/query filtering |
| `ask` | Ask any question about ADR codebase, APIs, or architecture |

#### Usage Examples

```
# Find services related to user management
resolve-service-id("participant management")
→ marketplace-api, participant-service, ...

# Get webhook documentation
get-service-docs("marketplace-api", query: "webhook configuration")
→ Endpoints, schemas, and AI-generated summary

# Ask a question
ask("How does participant authentication work?")
→ Synthesized answer with relevant code examples
```

#### Modes

- `mode: "code"` - API references, endpoints, code examples (default)
- `mode: "info"` - Conceptual guides, READMEs, architecture docs

#### Available Topics (Marketplace API)

`authentication` · `organization` · `program` · `participant` · `transaction` · `webhook` · `sso` · `points`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Recommended | Enables AI-powered semantic search and answer synthesis |
| `GITHUB_TOKEN` | Recommended | Higher rate limits for GitHub API (repo indexing) |
| `SWAGGERHUB_URL` | No | Custom SwaggerHub URL (defaults to ADR Marketplace API) |
| `ORG_NAME` | No | GitHub org to index (defaults to `alldigitalrewards`) |

Without `OPENAI_API_KEY`, the plugin falls back to keyword-based search (still functional, just less intelligent).

---

## Development

### Local Testing

```bash
# Clone the repository
git clone https://github.com/alldigitalrewards/claude-plugins.git
cd claude-plugins

# Install dependencies
npm install --workspaces

# Test the MCP server directly
node plugins/adr-context/src/mcp-servers/adr-context.js

# Add local marketplace for testing
/plugin marketplace add ./
```

### Contributing New Plugins

1. Create a new directory under `plugins/`
2. Add `.claude-plugin/plugin.json` with plugin metadata
3. Add `.mcp.json` for MCP server configuration
4. Update `marketplace.json` with the new plugin entry
5. Submit a PR for team review

---

## Roadmap

_Coming soon_

---

## Support

Questions or issues? Reach out in #platform-engineering or open an issue in this repo.

---

MIT License - AllDigitalRewards Engineering
