---
name: extract-schemas
description: Extract data models and schemas from an OpenAPI specification
arguments:
  - name: url
    description: URL to the OpenAPI/Swagger specification
    required: true
  - name: schema
    description: Specific schema name to extract (optional, extracts all if omitted)
    required: false
  - name: format
    description: Output format (markdown, typescript, json-schema)
    required: false
---

# Extract API Schemas

Extract data models and schemas from an OpenAPI specification for documentation or code generation.

## Usage

Get detailed schema definitions for API request/response objects.

Examples:
- `/extract-schemas https://api.swaggerhub.com/apis/ADR/Marketplace/2.2`
- `/extract-schemas ./spec.yaml --schema User`
- `/extract-schemas ./spec.yaml --format typescript`

## What This Command Does

1. Parses the OpenAPI specification
2. Extracts all component schemas
3. For each schema provides:
   - Schema name
   - Description
   - Properties with types
   - Required fields
   - Validation rules (min/max, patterns, enums)
   - Nested object relationships
4. Can generate TypeScript interfaces

## Output Formats

- **markdown**: Documentation-ready format with tables
- **typescript**: TypeScript interface definitions
- **json-schema**: Raw JSON Schema format
