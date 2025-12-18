---
name: parse-openapi
description: Parse an OpenAPI/Swagger specification URL and extract API documentation
arguments:
  - name: url
    description: URL to the OpenAPI/Swagger specification (JSON or YAML)
    required: true
  - name: format
    description: Output format (markdown, mdx, json)
    required: false
---

# Parse OpenAPI Specification

Parse a Swagger/OpenAPI specification URL and extract structured API documentation.

## Usage

Fetch and parse an OpenAPI spec to generate readable documentation.

Examples:
- `/parse-openapi https://api.swaggerhub.com/apis/ADR/Marketplace/2.2`
- `/parse-openapi https://petstore.swagger.io/v2/swagger.json --format mdx`
- `/parse-openapi ./api-spec.yaml --format markdown`

## What This Command Does

1. Fetches the OpenAPI specification from the provided URL
2. Validates the specification structure
3. Extracts and organizes:
   - API info (title, version, description)
   - Server URLs and environments
   - Authentication methods
   - All endpoints with methods
   - Request/response schemas
   - Example payloads
4. Generates formatted output ready for documentation

## Supported Formats

- **markdown**: Standard GitHub-flavored markdown
- **mdx**: MDX with React components for interactive docs
- **json**: Structured JSON for further processing
