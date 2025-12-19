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

## Version Pinning

For production-critical projects that need stability, pin to a specific marketplace version using git refs:

```json
{
  "extraKnownMarketplaces": {
    "adr-main": {
      "source": {
        "source": "github",
        "repo": "alldigitalrewards/claude-plugins",
        "ref": "v1.0.0"
      }
    }
  }
}
```

This ensures your team uses a known, tested version rather than automatically pulling the latest changes.

### Auto-Update Behavior

| Marketplace Type | Auto-Update Default |
|------------------|---------------------|
| Official Anthropic | Enabled |
| Third-party (like this one) | Disabled |
| Local development | Disabled |

Toggle auto-update via: `/plugin` → Marketplaces → Select marketplace → Configure

See: [Plugin Marketplaces Documentation](https://docs.anthropic.com/en/docs/claude-code/plugins#marketplaces)

---

## Security & Plugin Approval

### Our Approval Process

All plugins in this marketplace go through team review before merging:

1. **Code Review** - PR reviewed by at least one platform team member
2. **Security Check** - No credential exposure, safe API usage, no unexpected network calls
3. **Testing** - Plugin validated with `claude plugin validate .` before merge
4. **Documentation** - README and usage examples required

### Plugin Validation

Before submitting a new plugin, validate it locally:

```bash
# Validate marketplace and plugin structure
claude plugin validate .

# Test plugin installation
/plugin marketplace add ./
/plugin install your-plugin@local
```

### Permission Model

Claude Code uses a permission-based system for plugin operations. Plugins can request:

- Tool access (Bash, Read, Write, etc.)
- MCP server connections
- Network access for external APIs

Users are prompted to approve permissions on first use. See: [Claude Code Security](https://docs.anthropic.com/en/docs/claude-code/security)

---

## Enterprise Controls

For stricter governance, ADR can enforce marketplace restrictions organization-wide using managed settings.

### Restricting to Approved Marketplaces

Create a managed settings file to restrict which marketplaces users can add:

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "github",
      "repo": "alldigitalrewards/claude-plugins"
    }
  ]
}
```

### Managed Settings Locations

These files require admin privileges and cannot be overridden by users:

| Platform | Path |
|----------|------|
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.json` |
| Linux/WSL | `/etc/claude-code/managed-settings.json` |
| Windows | `C:\ProgramData\ClaudeCode\managed-settings.json` |

### What `strictKnownMarketplaces` Does

- Enforced at system level before any network/filesystem operations
- Uses exact matching (including `ref` and `path` fields if specified)
- Cannot be overridden by user or project settings
- Only affects adding NEW marketplaces—previously installed ones continue working

See: [Claude Code Settings Reference](https://docs.anthropic.com/en/docs/claude-code/settings)

---

## Best Practices (per Anthropic)

Anthropic recommends a layered approach to team plugin management:

| Stage | Approach |
|-------|----------|
| **Getting Started** | GitHub-hosted marketplace, manual installs |
| **Team Adoption** | Commit `.claude/settings.json` to repos for auto-install |
| **Enterprise** | Add `strictKnownMarketplaces` via managed settings |

### Key Recommendations

1. **Version control your configs** - Share `.claude/settings.json` in repos
2. **Document security processes** - Clear approval flow for new plugins
3. **Start simple, add controls later** - Don't over-engineer governance early
4. **Use MCP for integrations** - Check `.mcp.json` into codebases for shared tool access
5. **Deploy CLAUDE.md files** - Organization-wide standards in system directories

See: [Claude Code for Organizations](https://docs.anthropic.com/en/docs/claude-code/overview)

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

### Planned Plugins

- [ ] **Deployment Tools** - Staging/production deployment workflows, environment management
- [ ] **Code Review** - ADR coding standards enforcement, PR feedback automation
- [ ] **Database Migration Helper** - Schema change previews, migration script generation
- [ ] **Ticket Integration** - Link commits to tickets, auto-update status, context from issue tracker

### adr-context Enhancements

- [ ] Index more ADR services and internal repos
- [ ] Auto-generated API client stubs from OpenAPI specs
- [ ] Caching layer for faster repeated queries

Have an idea? Open an issue or reach out in #platform-engineering.

---

## Support

Questions or issues? Reach out in #platform-engineering or open an issue in this repo.

---

MIT License - AllDigitalRewards Engineering
