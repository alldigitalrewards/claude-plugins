---
name: generate-docs
description: Generate complete API documentation from an OpenAPI specification
arguments:
  - name: url
    description: URL to the OpenAPI/Swagger specification
    required: true
  - name: output
    description: Output directory for generated documentation
    required: false
  - name: template
    description: Documentation template (default, detailed, minimal)
    required: false
---

# Generate API Documentation

Generate complete, production-ready API documentation from an OpenAPI specification.

## Usage

Create comprehensive documentation ready to drop into your docs site.

Examples:
- `/generate-docs https://api.swaggerhub.com/apis/ADR/Marketplace/2.2`
- `/generate-docs ./spec.yaml --output ./docs/api`
- `/generate-docs ./spec.yaml --template detailed`

## What This Command Does

1. Parses the complete OpenAPI specification
2. Generates documentation structure:
   - Overview page with API info
   - Authentication guide
   - Endpoint pages grouped by tag
   - Schema reference pages
   - Example requests/responses
3. Creates navigation structure
4. Adds code examples in multiple languages

## Templates

- **default**: Balanced documentation with essential details
- **detailed**: Comprehensive docs with all fields and examples
- **minimal**: Quick reference style, endpoints and schemas only

## Output Structure

```
docs/
├── index.md              # API overview
├── authentication.md     # Auth methods
├── endpoints/
│   ├── users.md          # User endpoints
│   ├── orders.md         # Order endpoints
│   └── ...
├── schemas/
│   ├── user.md           # User schema
│   └── ...
└── examples/
    └── ...
```
