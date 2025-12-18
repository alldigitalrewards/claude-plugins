#!/usr/bin/env node

/**
 * OpenAPI Parser MCP Server for AllDigitalRewards API Docs Extractor
 *
 * Provides tools for parsing OpenAPI/Swagger specifications and
 * extracting documentation in various formats.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import SwaggerParser from "@apidevtools/swagger-parser";
import yaml from "js-yaml";

const SWAGGERHUB_API_KEY = process.env.SWAGGERHUB_API_KEY;

const server = new Server(
  {
    name: "openapi-parser",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

async function fetchSpec(url) {
  const headers = {};
  if (url.includes("swaggerhub.com") && SWAGGERHUB_API_KEY) {
    headers["Authorization"] = `Bearer ${SWAGGERHUB_API_KEY}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch spec: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  // Try JSON first, then YAML
  try {
    return JSON.parse(text);
  } catch {
    return yaml.load(text);
  }
}

function schemaToMarkdown(schema, name, indent = 0) {
  const spaces = "  ".repeat(indent);
  let md = "";

  if (schema.description) {
    md += `${spaces}${schema.description}\n\n`;
  }

  if (schema.properties) {
    md += `${spaces}| Property | Type | Required | Description |\n`;
    md += `${spaces}|----------|------|----------|-------------|\n`;

    for (const [propName, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(propName) ? "Yes" : "No";
      const type = prop.type || (prop.$ref ? prop.$ref.split("/").pop() : "object");
      const desc = prop.description || "-";
      md += `${spaces}| ${propName} | ${type} | ${required} | ${desc} |\n`;
    }
  }

  return md;
}

function endpointToMarkdown(path, method, operation) {
  let md = `## ${method.toUpperCase()} ${path}\n\n`;

  if (operation.summary) {
    md += `**${operation.summary}**\n\n`;
  }

  if (operation.description) {
    md += `${operation.description}\n\n`;
  }

  if (operation.tags?.length) {
    md += `**Tags:** ${operation.tags.join(", ")}\n\n`;
  }

  // Parameters
  if (operation.parameters?.length) {
    md += `### Parameters\n\n`;
    md += `| Name | In | Type | Required | Description |\n`;
    md += `|------|-----|------|----------|-------------|\n`;

    for (const param of operation.parameters) {
      const required = param.required ? "Yes" : "No";
      const type = param.schema?.type || param.type || "string";
      md += `| ${param.name} | ${param.in} | ${type} | ${required} | ${param.description || "-"} |\n`;
    }
    md += "\n";
  }

  // Request body
  if (operation.requestBody) {
    md += `### Request Body\n\n`;
    const content = operation.requestBody.content;
    const mediaType = Object.keys(content)[0];
    md += `**Content-Type:** ${mediaType}\n\n`;

    if (content[mediaType]?.schema) {
      const schema = content[mediaType].schema;
      if (schema.$ref) {
        md += `**Schema:** ${schema.$ref.split("/").pop()}\n\n`;
      } else {
        md += schemaToMarkdown(schema, "RequestBody");
      }
    }
  }

  // Responses
  if (operation.responses) {
    md += `### Responses\n\n`;
    for (const [code, response] of Object.entries(operation.responses)) {
      md += `#### ${code}\n\n`;
      md += `${response.description || "No description"}\n\n`;
    }
  }

  return md;
}

function schemaToTypeScript(schema, name) {
  let ts = `interface ${name} {\n`;

  if (schema.properties) {
    for (const [propName, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(propName);
      const optional = required ? "" : "?";

      let type = "unknown";
      if (prop.type === "string") type = "string";
      else if (prop.type === "integer" || prop.type === "number") type = "number";
      else if (prop.type === "boolean") type = "boolean";
      else if (prop.type === "array") {
        const itemType = prop.items?.$ref?.split("/").pop() || prop.items?.type || "unknown";
        type = `${itemType}[]`;
      } else if (prop.$ref) {
        type = prop.$ref.split("/").pop();
      } else if (prop.type === "object") {
        type = "Record<string, unknown>";
      }

      if (prop.description) {
        ts += `  /** ${prop.description} */\n`;
      }
      ts += `  ${propName}${optional}: ${type};\n`;
    }
  }

  ts += "}\n";
  return ts;
}

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "parse_openapi",
        description: "Parse an OpenAPI/Swagger specification and return structured data",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to the OpenAPI specification (JSON or YAML)",
            },
            include_schemas: {
              type: "boolean",
              description: "Include component schemas in output",
              default: true,
            },
          },
          required: ["url"],
        },
      },
      {
        name: "extract_endpoints",
        description: "Extract all API endpoints from an OpenAPI specification",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to the OpenAPI specification",
            },
            tag: {
              type: "string",
              description: "Filter endpoints by tag",
            },
            method: {
              type: "string",
              enum: ["get", "post", "put", "delete", "patch"],
              description: "Filter by HTTP method",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "extract_schemas",
        description: "Extract data models/schemas from an OpenAPI specification",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to the OpenAPI specification",
            },
            schema_name: {
              type: "string",
              description: "Specific schema name to extract",
            },
            format: {
              type: "string",
              enum: ["markdown", "typescript", "json"],
              description: "Output format",
              default: "markdown",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "generate_markdown_docs",
        description: "Generate complete markdown documentation from an OpenAPI spec",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to the OpenAPI specification",
            },
            template: {
              type: "string",
              enum: ["default", "detailed", "minimal"],
              description: "Documentation template style",
              default: "default",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const spec = await fetchSpec(args.url);
    const api = await SwaggerParser.validate(spec);

    switch (name) {
      case "parse_openapi": {
        const result = {
          info: api.info,
          servers: api.servers || [],
          paths: Object.keys(api.paths || {}),
          tags: api.tags || [],
        };

        if (args.include_schemas !== false) {
          result.schemas = Object.keys(api.components?.schemas || {});
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "extract_endpoints": {
        const endpoints = [];

        for (const [path, pathItem] of Object.entries(api.paths || {})) {
          for (const [method, operation] of Object.entries(pathItem)) {
            if (["get", "post", "put", "delete", "patch", "options", "head"].includes(method)) {
              // Apply filters
              if (args.method && method !== args.method) continue;
              if (args.tag && !operation.tags?.includes(args.tag)) continue;

              endpoints.push({
                method: method.toUpperCase(),
                path,
                operationId: operation.operationId,
                summary: operation.summary,
                tags: operation.tags || [],
                parameters: operation.parameters?.length || 0,
              });
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: endpoints.length, endpoints }, null, 2),
            },
          ],
        };
      }

      case "extract_schemas": {
        const schemas = api.components?.schemas || {};
        const format = args.format || "markdown";

        if (args.schema_name) {
          const schema = schemas[args.schema_name];
          if (!schema) {
            throw new Error(`Schema '${args.schema_name}' not found`);
          }

          let output;
          if (format === "typescript") {
            output = schemaToTypeScript(schema, args.schema_name);
          } else if (format === "json") {
            output = JSON.stringify(schema, null, 2);
          } else {
            output = `# ${args.schema_name}\n\n${schemaToMarkdown(schema, args.schema_name)}`;
          }

          return {
            content: [{ type: "text", text: output }],
          };
        }

        // Return all schemas
        let output = "";
        for (const [schemaName, schema] of Object.entries(schemas)) {
          if (format === "typescript") {
            output += schemaToTypeScript(schema, schemaName) + "\n";
          } else if (format === "json") {
            output += JSON.stringify({ [schemaName]: schema }, null, 2) + "\n\n";
          } else {
            output += `# ${schemaName}\n\n${schemaToMarkdown(schema, schemaName)}\n---\n\n`;
          }
        }

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "generate_markdown_docs": {
        let md = `# ${api.info.title}\n\n`;
        md += `**Version:** ${api.info.version}\n\n`;

        if (api.info.description) {
          md += `## Overview\n\n${api.info.description}\n\n`;
        }

        // Servers
        if (api.servers?.length) {
          md += `## Servers\n\n`;
          for (const server of api.servers) {
            md += `- **${server.url}**${server.description ? ` - ${server.description}` : ""}\n`;
          }
          md += "\n";
        }

        // Authentication
        if (api.components?.securitySchemes) {
          md += `## Authentication\n\n`;
          for (const [name, scheme] of Object.entries(api.components.securitySchemes)) {
            md += `### ${name}\n\n`;
            md += `- **Type:** ${scheme.type}\n`;
            if (scheme.scheme) md += `- **Scheme:** ${scheme.scheme}\n`;
            if (scheme.description) md += `- **Description:** ${scheme.description}\n`;
            md += "\n";
          }
        }

        // Endpoints
        md += `## Endpoints\n\n`;
        for (const [path, pathItem] of Object.entries(api.paths || {})) {
          for (const [method, operation] of Object.entries(pathItem)) {
            if (["get", "post", "put", "delete", "patch"].includes(method)) {
              md += endpointToMarkdown(path, method, operation);
              md += "---\n\n";
            }
          }
        }

        // Schemas (minimal for default template)
        if (args.template !== "minimal" && api.components?.schemas) {
          md += `## Schemas\n\n`;
          for (const [schemaName, schema] of Object.entries(api.components.schemas)) {
            md += `### ${schemaName}\n\n`;
            md += schemaToMarkdown(schema, schemaName);
            md += "\n";
          }
        }

        return {
          content: [{ type: "text", text: md }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenAPI Parser MCP server running on stdio");
}

main().catch(console.error);
