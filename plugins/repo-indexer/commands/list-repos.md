---
name: list-repos
description: List all repositories in the AllDigitalRewards organization
arguments:
  - name: type
    description: Filter by repo type (all, public, private, forks, sources)
    required: false
  - name: sort
    description: Sort by (created, updated, pushed, full_name)
    required: false
  - name: tag
    description: Filter by topic/tag
    required: false
---

# List Repositories

List all repositories in the AllDigitalRewards GitHub organization.

## Usage

Get an overview of all ADR repositories with optional filtering and sorting.

Examples:
- `/list-repos` - List all repositories
- `/list-repos --type private` - List only private repos
- `/list-repos --sort updated` - Sort by last updated
- `/list-repos --tag rewardstack` - Filter by topic tag

## What This Command Does

1. Queries GitHub API for organization repositories
2. Returns list with metadata:
   - Repository name and description
   - Visibility (public/private)
   - Primary language
   - Topics/tags
   - Last activity date
3. Supports pagination for large organizations

Use this to discover what services and tools exist in the ADR ecosystem.
