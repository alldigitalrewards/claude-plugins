---
name: repo-search
description: Search AllDigitalRewards repositories by name, tag, or keyword
arguments:
  - name: query
    description: Search term, repository name, or keyword to search for
    required: true
  - name: org
    description: GitHub organization to search (defaults to alldigitalrewards)
    required: false
---

# Repository Search

Search AllDigitalRewards repositories on GitHub using the GitHub API.

## Usage

Search for repositories matching the query within the AllDigitalRewards organization.

Examples:
- `/repo-search payment-api` - Find repos matching "payment-api"
- `/repo-search marketplace --org alldigitalrewards` - Search specific org
- `/repo-search sdk` - Find all SDK repositories

## What This Command Does

1. Queries the GitHub API for repositories matching your search term
2. Returns repository metadata including:
   - Repository name and description
   - Primary language
   - Star count and fork count
   - Last updated date
   - Default branch
3. Filters results to the specified organization

Use the `repo-tree` command to explore a specific repository's file structure.
