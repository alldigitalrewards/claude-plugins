# AllDigitalRewards Claude Code Plugins

Official plugin marketplace for AllDigitalRewards internal tools and integrations with Claude Code.

## Installation

Add this marketplace to your Claude Code installation:

```bash
/plugin marketplace add alldigitalrewards/claude-plugins
```

Or configure in your `.claude/settings.json`:

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
    "repo-indexer@adr-main": true,
    "api-docs-extractor@adr-main": true
  }
}
```

## Available Plugins

### Repo Indexer

Search and index AllDigitalRewards repositories with GitHub API integration.

**Commands:**
- `/repo-search <query>` - Search repositories by name, tag, or keyword
- `/repo-tree <repo>` - Fetch file tree structure of a repository
- `/repo-readme <repo>` - Fetch README and documentation files
- `/list-repos` - List all repositories in the organization

**Agents:**
- `repo-analyzer` - Deep analysis of repository structure and dependencies
- `service-mapper` - Map relationships between ADR services

**Requirements:**
- `GITHUB_TOKEN` environment variable for API access

### API Docs Extractor

Parse Swagger/OpenAPI URLs and output Markdown/MDX documentation sections.

**Commands:**
- `/parse-openapi <url>` - Parse OpenAPI spec and extract documentation
- `/extract-endpoints <url>` - Extract all API endpoints
- `/extract-schemas <url>` - Extract data models and schemas
- `/generate-docs <url>` - Generate complete API documentation

**Agents:**
- `docs-generator` - Generate comprehensive API documentation
- `schema-analyzer` - Analyze OpenAPI schemas and type relationships

**Requirements:**
- `SWAGGERHUB_API_KEY` environment variable (optional, for SwaggerHub APIs)

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/alldigitalrewards/claude-plugins.git
cd claude-plugins

# Install dependencies
npm install --workspaces
```

### Structure

```
.
├── .claude-plugin/
│   └── marketplace.json      # Marketplace manifest
├── plugins/
│   ├── repo-indexer/         # Repository indexer plugin
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   ├── agents/
│   │   └── src/mcp-servers/
│   └── api-docs-extractor/   # API docs extractor plugin
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── commands/
│       ├── agents/
│       └── src/mcp-servers/
├── package.json
└── README.md
```

### Adding a New Plugin

1. Create a new directory under `plugins/`
2. Add `.claude-plugin/plugin.json` manifest
3. Implement commands, agents, and/or MCP servers
4. Register the plugin in `.claude-plugin/marketplace.json`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub personal access token for API access |
| `SWAGGERHUB_API_KEY` | No | SwaggerHub API key for private API specs |

## License

MIT - AllDigitalRewards Engineering
