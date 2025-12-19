---
name: adr-registry
description: Understand ADR repository structure, CI/CD patterns, service tiers, and language distribution. Use when discussing new services, architecture decisions, CI/CD setup, repo modernization, or codebase patterns.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# ADR Repository Registry Context

This skill provides comprehensive knowledge about the AllDigitalRewards (ADR) repository ecosystem, including service architecture, CI/CD patterns, and modernization priorities.

## When to Use This Skill

Invoke this skill when:
- Discussing new service creation or architecture decisions
- Setting up CI/CD workflows for repositories
- Analyzing codebase patterns or technology choices
- Planning repository modernization or upgrades
- Understanding service dependencies and integration points
- Identifying repos needing attention (high issue counts, missing CI/CD)

## Repository Structure Overview

The ADR organization consists of **120+ active repositories** organized into distinct tiers:

### Service Tiers

#### Core Platform (Tier 1)
Primary services with **full CI/CD pipelines** and high development activity:
- **rewardstack** - Core rewards platform backend (PHP)
- **marketplace-client** - Marketplace frontend (PHP)
- **rewardstack-ui** - Modern React/TypeScript UI
- **changemaker** - Next-gen platform modernization (TypeScript) - **Reference implementation for CI/CD**
- **catalog** - Product catalog service (PHP)
- **program-content-mgmt** - Program content management (PHP)

#### Fulfillment Services
Vendor integration services for gift cards and digital rewards:
- **incomm-fulfillment** (InComm) - Has CI/CD
- **amazon-fulfillment**, **neocurrency-fulfillment**, **galileo-fulfillment**, **replink-fulfillment**, **paypal-fulfillment** - Need CI/CD

#### EZ Platform (Microservices)
Newer microservices architecture pattern:
- **Core**: ez-order, ez-catalog, ez-billing, ez-email, eze-claim
- **UI**: ez-gui, eze-claim-gui (TypeScript)
- **Maintenance**: ez-maintenance-{incomm,neo,amazon,galileo} (JavaScript)

**Note**: Most EZ services lack CI/CD - high priority for standardization

#### SDKs & Libraries
- **rewardstack-sdk** - Public PHP SDK
- **incomm-sdk**, **replink-vendor-sdk**, **galileo-wrapper** - Vendor API wrappers

#### Infrastructure Services
- **identity-manager**, **dashboard-service**, **transaction-email**, **shipping**, **card-account**

#### AI & Tooling
- **claude-plugins**, **adr-context-mcp**, **adr-slack-bot**, **rewardstack-mcp**

## Technology Distribution

- **PHP**: 75 repositories (75%)
- **TypeScript**: 15 repositories (15%)
- **JavaScript**: 12 repositories
- **Python**: 6 repositories
- **Go/Rust**: 2 repositories

**Key Insight**: ADR is primarily a PHP shop with growing TypeScript adoption for frontends.

## CI/CD Patterns

### Repos with CI/CD
1. **rewardstack** - build-and-push.yml, tests.yml
2. **marketplace-client** - build-and-push.yml, lint-twig.yml, tests.yml
3. **rewardstack-ui** - build-and-push.yml, tests.yml
4. **changemaker** - database-migration.yml, deploy-staging-migrations.yml, pr-checks.yml, issue-sync.yml, sync-labels.yml
5. **catalog** - build-and-push.yml, tests.yml
6. **incomm-fulfillment** - build-and-push.yml

### Repos Needing CI/CD
- adr-nextjs (Next.js frontend)
- dashboard-service
- Most ez-* services
- All fulfillment services except incomm-fulfillment

### Standard Pattern
```yaml
workflows:
  - build-and-push.yml    # Build Docker image, push to us-docker.pkg.dev
  - tests.yml             # Run test suite
```

## High-Priority Repositories

### High Issue Counts
1. **rewardstack-ui** - 51 open issues
2. **changemaker** - 42 open issues
3. **catalog** - 20 open issues
4. **marketplace-client** - 19 open issues
5. **card-account** - 10 open issues

## Service Dependencies

```
rewardstack (core)
  -> marketplace-client
  -> catalog
  -> card-account

fulfillment services -> vendor SDKs
  -> incomm-fulfillment -> incomm-sdk
  -> replink-fulfillment -> replink-vendor-sdk

ez-platform -> ez-service-sdk
```

## Artifact Registry

**Migration Complete**: All services use `us-docker.pkg.dev` (migrated from gcr.io)

## Registry File

The authoritative registry is at: `adr-repos.yaml`

Updated: 2025-12-19 | Organization: alldigitalrewards
