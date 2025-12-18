---
name: repo-readme
description: Fetch and display README, CHANGELOG, or documentation from an ADR repository
arguments:
  - name: repo
    description: Repository name (e.g., marketplace-api, rewardstack-sdk)
    required: true
  - name: file
    description: Specific file to fetch (defaults to README.md)
    required: false
  - name: branch
    description: Branch to fetch from (defaults to main/master)
    required: false
---

# Repository Documentation Fetcher

Fetch README, CHANGELOG, and other documentation files from AllDigitalRewards repositories.

## Usage

Quickly retrieve documentation without cloning the entire repository.

Examples:
- `/repo-readme marketplace-api` - Get README.md
- `/repo-readme rewardstack-sdk --file CHANGELOG.md` - Get changelog
- `/repo-readme payment-service --file docs/API.md` - Get specific doc file

## What This Command Does

1. Fetches the specified file content via GitHub API
2. Returns rendered markdown content
3. Caches results for faster subsequent access
4. Handles common documentation locations:
   - README.md
   - CHANGELOG.md
   - docs/ directory
   - API documentation

Use this to quickly understand a service's purpose and recent changes.
