---
name: repo-tree
description: Fetch and display the file tree structure of an ADR repository
arguments:
  - name: repo
    description: Repository name (e.g., marketplace-api, rewardstack-sdk)
    required: true
  - name: branch
    description: Branch to fetch tree from (defaults to main/master)
    required: false
  - name: path
    description: Subdirectory path to focus on
    required: false
---

# Repository Tree

Fetch and display the file tree structure of an AllDigitalRewards repository.

## Usage

Get the complete file structure of a repository to understand its architecture.

Examples:
- `/repo-tree marketplace-api` - Full tree of marketplace-api repo
- `/repo-tree rewardstack-sdk --branch develop` - Tree from develop branch
- `/repo-tree payment-service --path src/controllers` - Focus on specific directory

## What This Command Does

1. Fetches the repository tree via GitHub API
2. Displays hierarchical file/folder structure
3. Highlights important files:
   - README.md, CHANGELOG.md
   - package.json, composer.json
   - Configuration files
   - Documentation directories
4. Provides size information for files

Use this to quickly understand repository organization before diving into specific files.
