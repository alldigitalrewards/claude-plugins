---
name: extract-endpoints
description: Extract all API endpoints from an OpenAPI specification
arguments:
  - name: url
    description: URL to the OpenAPI/Swagger specification
    required: true
  - name: tag
    description: Filter endpoints by tag/category
    required: false
  - name: method
    description: Filter by HTTP method (get, post, put, delete, patch)
    required: false
---

# Extract API Endpoints

Extract and list all API endpoints from an OpenAPI specification with optional filtering.

## Usage

Get a quick overview of all available endpoints in an API.

Examples:
- `/extract-endpoints https://api.swaggerhub.com/apis/ADR/Marketplace/2.2`
- `/extract-endpoints ./spec.yaml --tag users` - Filter by tag
- `/extract-endpoints ./spec.yaml --method post` - Only POST endpoints

## What This Command Does

1. Parses the OpenAPI specification
2. Extracts all paths and operations
3. For each endpoint provides:
   - HTTP method
   - Path
   - Operation ID
   - Summary/description
   - Tags
   - Required parameters
   - Authentication requirements
4. Supports filtering by tag or method

## Output Format

```
POST   /users           Create a new user           [users, admin]
GET    /users/{id}      Get user by ID              [users]
PUT    /users/{id}      Update user                 [users]
DELETE /users/{id}      Delete user                 [users, admin]
```
