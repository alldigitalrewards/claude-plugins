#!/usr/bin/env node

/**
 * ADR Context - Context7-style MCP Server for AllDigitalRewards
 *
 * Provides up-to-date documentation and code examples for ADR services,
 * APIs, and libraries. Works like Context7 but for internal ADR resources.
 *
 * Tools:
 * - resolve-service-id: Find ADR services/repos by name
 * - get-service-docs: Fetch docs and code for a resolved service
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const GITHUB_API_URL = process.env.GITHUB_API_URL || "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ORG_NAME = process.env.ORG_NAME || "alldigitalrewards";
const SWAGGERHUB_URL = process.env.SWAGGERHUB_URL || "https://api.swaggerhub.com/apis/AllDigitalRewards/Marketplace/2.2";

const headers = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "ADR-Context",
  ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
};

// ============================================================================
// Service Registry - Maps friendly names to resources
// ============================================================================

const SERVICE_REGISTRY = {
  // APIs
  "marketplace-api": {
    type: "api",
    name: "ADR Marketplace Platform API",
    description: "Core marketplace API for organizations, programs, participants, and transactions",
    swagger_url: "https://api.swaggerhub.com/apis/AllDigitalRewards/Marketplace/2.2",
    topics: ["authentication", "organization", "program", "participant", "transaction", "webhook", "sso", "points"],
  },

  // Repositories (populated dynamically)
};

// ============================================================================
// GitHub API Helpers
// ============================================================================

async function githubRequest(endpoint) {
  const url = `${GITHUB_API_URL}${endpoint}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchOrgRepos() {
  const repos = await githubRequest(`/orgs/${ORG_NAME}/repos?per_page=100&sort=updated`);
  return repos.map((r) => ({
    id: r.name,
    name: r.name,
    description: r.description,
    language: r.language,
    topics: r.topics || [],
    url: r.html_url,
    default_branch: r.default_branch,
  }));
}

async function fetchRepoContent(repo, path, branch) {
  const branchParam = branch ? `?ref=${branch}` : "";
  const data = await githubRequest(`/repos/${ORG_NAME}/${repo}/contents/${path}${branchParam}`);

  if (data.type === "file") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  return null;
}

async function fetchRepoTree(repo, branch) {
  if (!branch) {
    const repoData = await githubRequest(`/repos/${ORG_NAME}/${repo}`);
    branch = repoData.default_branch;
  }

  const treeData = await githubRequest(`/repos/${ORG_NAME}/${repo}/git/trees/${branch}?recursive=1`);
  return treeData.tree;
}

// ============================================================================
// API Documentation Helpers
// ============================================================================

async function fetchApiSpec(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch API spec: ${response.status}`);
  }
  return response.json();
}

function extractApiDocs(spec, topic, mode = "code") {
  const results = { endpoints: [], schemas: [], examples: [] };

  if (!topic) {
    // Return overview
    return {
      title: spec.info?.title,
      version: spec.info?.version,
      description: spec.info?.description,
      servers: spec.servers,
      tags: spec.tags?.map((t) => t.name) || [],
      pathCount: Object.keys(spec.paths || {}).length,
      schemaCount: Object.keys(spec.components?.schemas || {}).length,
    };
  }

  const topicLower = topic.toLowerCase();

  // Search endpoints
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;

      const searchText = [
        path,
        operation.summary || "",
        operation.description || "",
        ...(operation.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      if (searchText.includes(topicLower)) {
        const endpoint = {
          method: method.toUpperCase(),
          path,
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags,
        };

        if (mode === "code") {
          // Include request/response details
          endpoint.parameters = operation.parameters?.map((p) => ({
            name: p.name,
            in: p.in,
            required: p.required,
            type: p.schema?.type,
            description: p.description,
          }));

          if (operation.requestBody?.content) {
            const mediaType = Object.keys(operation.requestBody.content)[0];
            const schema = operation.requestBody.content[mediaType]?.schema;
            endpoint.requestBody = {
              contentType: mediaType,
              schema: schema?.$ref?.split("/").pop() || schema,
            };
          }

          if (operation.responses) {
            endpoint.responses = Object.entries(operation.responses).map(([code, resp]) => ({
              code,
              description: resp.description,
            }));
          }
        }

        results.endpoints.push(endpoint);
      }
    }
  }

  // Search schemas
  const schemas = spec.components?.schemas || spec.definitions || {};
  for (const [name, schema] of Object.entries(schemas)) {
    const searchText = [name, schema.description || "", ...Object.keys(schema.properties || [])]
      .join(" ")
      .toLowerCase();

    if (searchText.includes(topicLower)) {
      const schemaInfo = {
        name,
        description: schema.description,
      };

      if (mode === "code") {
        schemaInfo.properties = Object.entries(schema.properties || {}).map(([propName, prop]) => ({
          name: propName,
          type: prop.type || (prop.$ref ? prop.$ref.split("/").pop() : "object"),
          description: prop.description,
          required: schema.required?.includes(propName),
        }));
      }

      results.schemas.push(schemaInfo);
    }
  }

  return results;
}

// ============================================================================
// Repository Documentation Helpers
// ============================================================================

async function extractRepoDocs(repo, topic, mode = "code") {
  const results = { readme: null, files: [], codeSnippets: [] };

  try {
    // Fetch README
    try {
      results.readme = await fetchRepoContent(repo, "README.md");
    } catch {
      // No README
    }

    // Fetch tree
    const tree = await fetchRepoTree(repo);

    // Find relevant files
    const relevantExtensions = [".js", ".ts", ".php", ".py", ".md", ".json"];
    const relevantFiles = tree.filter(
      (item) =>
        item.type === "blob" && relevantExtensions.some((ext) => item.path.endsWith(ext))
    );

    // If topic specified, filter and fetch content
    if (topic && mode === "code") {
      const topicLower = topic.toLowerCase();

      // Find files matching topic
      const matchingFiles = relevantFiles
        .filter((f) => f.path.toLowerCase().includes(topicLower))
        .slice(0, 5);

      for (const file of matchingFiles) {
        try {
          const content = await fetchRepoContent(repo, file.path);
          if (content) {
            results.codeSnippets.push({
              path: file.path,
              content: content.slice(0, 2000), // Truncate large files
              truncated: content.length > 2000,
            });
          }
        } catch {
          // Skip inaccessible files
        }
      }
    }

    // Always include file tree summary
    results.files = relevantFiles.slice(0, 50).map((f) => ({
      path: f.path,
      size: f.size,
    }));

  } catch (error) {
    results.error = error.message;
  }

  return results;
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "adr-context",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools (Context7-style)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "resolve-service-id",
        description:
          "Resolves an ADR service/product name to a Context-compatible service ID. " +
          "Call this BEFORE 'get-service-docs' to find the correct service ID. " +
          "Returns matching services with descriptions and available topics.",
        inputSchema: {
          type: "object",
          properties: {
            serviceName: {
              type: "string",
              description:
                "Service name to search for (e.g., 'marketplace', 'participant', 'webhook', 'sdk')",
            },
          },
          required: ["serviceName"],
        },
      },
      {
        name: "get-service-docs",
        description:
          "Fetches up-to-date documentation for an ADR service. " +
          "You must call 'resolve-service-id' first to get the service ID. " +
          "Use mode='code' for API references and code examples, " +
          "or mode='info' for conceptual guides and architecture.",
        inputSchema: {
          type: "object",
          properties: {
            serviceId: {
              type: "string",
              description:
                "Service ID from 'resolve-service-id' (e.g., 'marketplace-api', 'rewardstack-sdk')",
            },
            topic: {
              type: "string",
              description:
                "Topic to focus on (e.g., 'webhook', 'authentication', 'participant', 'transaction')",
            },
            mode: {
              type: "string",
              enum: ["code", "info"],
              description: "Documentation mode: 'code' for API/code examples, 'info' for conceptual docs",
              default: "code",
            },
          },
          required: ["serviceId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "resolve-service-id": {
        const searchTerm = args.serviceName.toLowerCase();
        const results = [];

        // Search in service registry
        for (const [id, service] of Object.entries(SERVICE_REGISTRY)) {
          if (
            id.includes(searchTerm) ||
            service.name.toLowerCase().includes(searchTerm) ||
            service.description?.toLowerCase().includes(searchTerm) ||
            service.topics?.some((t) => t.includes(searchTerm))
          ) {
            results.push({
              id,
              type: service.type,
              name: service.name,
              description: service.description,
              topics: service.topics,
            });
          }
        }

        // Search GitHub repos
        const repos = await fetchOrgRepos();
        for (const repo of repos) {
          if (
            repo.name.toLowerCase().includes(searchTerm) ||
            repo.description?.toLowerCase().includes(searchTerm) ||
            repo.topics?.some((t) => t.includes(searchTerm))
          ) {
            // Don't duplicate if already in registry
            if (!results.find((r) => r.id === repo.name)) {
              results.push({
                id: repo.id,
                type: "repository",
                name: repo.name,
                description: repo.description,
                language: repo.language,
                topics: repo.topics,
              });
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: args.serviceName,
                  count: results.length,
                  services: results,
                  hint:
                    results.length > 0
                      ? `Use 'get-service-docs' with serviceId='${results[0].id}' to fetch documentation`
                      : "No matching services found. Try a different search term.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get-service-docs": {
        const serviceId = args.serviceId;
        const topic = args.topic;
        const mode = args.mode || "code";

        // Check if it's a registered API
        const registeredService = SERVICE_REGISTRY[serviceId];

        if (registeredService?.type === "api") {
          // Fetch API documentation
          const spec = await fetchApiSpec(registeredService.swagger_url);
          const docs = extractApiDocs(spec, topic, mode);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    serviceId,
                    serviceName: registeredService.name,
                    type: "api",
                    topic: topic || "overview",
                    mode,
                    documentation: docs,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Treat as repository
        const repoDocs = await extractRepoDocs(serviceId, topic, mode);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  serviceId,
                  type: "repository",
                  topic: topic || "overview",
                  mode,
                  documentation: repoDocs,
                },
                null,
                2
              ),
            },
          ],
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
  console.error("ADR Context MCP server running on stdio");
}

main().catch(console.error);
