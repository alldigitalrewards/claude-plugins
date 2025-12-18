# AllDigitalRewards Claude Code Plugins

Context7-style plugin marketplace for AllDigitalRewards - provides up-to-date documentation and code for ADR services directly in your Claude Code workflow.

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
    "adr-context@adr-main": true
  }
}
```

## ADR Context Plugin

**Context7-style documentation server** that provides up-to-date docs and code for ADR services, APIs, and repositories.

### Usage

Just add `use adr context` to your prompts, or configure auto-rules.

### Tools

#### `resolve-service-id`

Find ADR services by name. Call this first to get a service ID.

```
resolve-service-id("marketplace")
→ marketplace-api, claude-plugins, marketplace

resolve-service-id("webhook")
→ marketplace-api (has webhook topic)

resolve-service-id("sdk")
→ rewardstack-sdk, neo-currency-sdk, WeGift, carrier-tracking-sdk
```

#### `get-service-docs`

Fetch documentation for a resolved service. Supports topic filtering and two modes:

- `mode: "code"` - API references, code examples, parameters
- `mode: "info"` - Conceptual guides, READMEs, architecture

```
get-service-docs("marketplace-api", topic: "webhook")
→ 7 webhook endpoints, 5 webhook schemas

get-service-docs("marketplace-api", topic: "participant")
→ 19 participant endpoints, 11 schemas

get-service-docs("rewardstack-sdk", mode: "info")
→ README, file tree, repository structure
```

### Available Topics (Marketplace API)

- `authentication` - Token generation and auth
- `organization` - Org management endpoints
- `program` - Program configuration
- `participant` - User management
- `transaction` - Transaction history
- `webhook` - Webhook configuration
- `sso` - Single sign-on
- `points` - Point adjustments

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Recommended | GitHub token for higher rate limits |
| `SWAGGERHUB_URL` | No | Custom SwaggerHub URL (defaults to ADR Marketplace API) |

## Development

```bash
# Clone the repository
git clone https://github.com/alldigitalrewards/claude-plugins.git
cd claude-plugins

# Install dependencies
npm install --workspaces

# Test the server
node plugins/adr-context/src/mcp-servers/adr-context.js
```

## License

MIT - AllDigitalRewards Engineering
