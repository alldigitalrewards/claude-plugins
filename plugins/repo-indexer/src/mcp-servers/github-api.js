#!/usr/bin/env node

/**
 * GitHub API MCP Server for AllDigitalRewards Repository Indexer
 *
 * Provides tools for searching, listing, and fetching repository data
 * from the AllDigitalRewards GitHub organization.
 *
 * Enhanced with code search and question-answering capabilities.
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
  "Accept": "application/vnd.github.v3+json",
  "User-Agent": "ADR-Repo-Indexer",
  ...(GITHUB_TOKEN && { "Authorization": `Bearer ${GITHUB_TOKEN}` }),
};

async function githubRequest(endpoint, options = {}) {
  const url = `${GITHUB_API_URL}${endpoint}`;
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Helper to search code across the org
async function searchCode(query, org, options = {}) {
  const { language, filename, extension, path, per_page = 20 } = options;

  let q = `${query} org:${org}`;
  if (language) q += ` language:${language}`;
  if (filename) q += ` filename:${filename}`;
  if (extension) q += ` extension:${extension}`;
  if (path) q += ` path:${path}`;

  const encodedQuery = encodeURIComponent(q);
  const data = await githubRequest(`/search/code?q=${encodedQuery}&per_page=${per_page}`);

  return data;
}

// Helper to get file content with context around matches
async function getFileWithContext(org, repo, path, searchTerm, contextLines = 5) {
  const branch = "";
  const data = await githubRequest(`/repos/${org}/${repo}/contents/${path}${branch}`);

  if (data.type !== "file") {
    throw new Error(`Path ${path} is not a file`);
  }

  const content = Buffer.from(data.content, "base64").toString("utf-8");
  const lines = content.split('\n');

  // Find lines matching the search term and extract context
  const snippets = [];
  const searchLower = searchTerm.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(searchLower)) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines + 1);
      const snippet = lines.slice(start, end).map((line, idx) => {
        const lineNum = start + idx + 1;
        const marker = (start + idx === i) ? '>' : ' ';
        return `${marker}${lineNum.toString().padStart(4)}: ${line}`;
      }).join('\n');

      snippets.push({
        line: i + 1,
        snippet,
        match: lines[i].trim()
      });
    }
  }

  return { path, snippets, totalLines: lines.length };
}

// Helper to fetch and parse OpenAPI spec
async function fetchApiDocs(url = SWAGGERHUB_URL) {
  const response = await fetch(url, {
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch API docs: ${response.status}`);
  }

  return response.json();
}

// Search API docs for relevant endpoints/schemas
function searchApiDocs(spec, query) {
  const results = {
    endpoints: [],
    schemas: [],
    descriptions: []
  };

  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  // Search paths/endpoints
  if (spec.paths) {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

        const searchText = [
          path,
          operation.summary || '',
          operation.description || '',
          operation.operationId || '',
          ...(operation.tags || [])
        ].join(' ').toLowerCase();

        const matches = queryTerms.filter(term => searchText.includes(term));
        if (matches.length > 0) {
          results.endpoints.push({
            method: method.toUpperCase(),
            path,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags,
            operationId: operation.operationId,
            relevance: matches.length / queryTerms.length
          });
        }
      }
    }
  }

  // Search schemas
  const schemas = spec.components?.schemas || spec.definitions || {};
  for (const [name, schema] of Object.entries(schemas)) {
    const searchText = [
      name,
      schema.description || '',
      ...Object.keys(schema.properties || {})
    ].join(' ').toLowerCase();

    const matches = queryTerms.filter(term => searchText.includes(term));
    if (matches.length > 0) {
      results.schemas.push({
        name,
        description: schema.description,
        properties: Object.keys(schema.properties || {}),
        relevance: matches.length / queryTerms.length
      });
    }
  }

  // Sort by relevance
  results.endpoints.sort((a, b) => b.relevance - a.relevance);
  results.schemas.sort((a, b) => b.relevance - a.relevance);

  return results;
}

const server = new Server(
  {
    name: "github-repo-api",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ask",
        description: "Ask a question about AllDigitalRewards codebase and APIs. Searches source code and API documentation to find relevant answers with code snippets.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "Your question about the ADR codebase, APIs, or architecture (e.g., 'How does authentication work?', 'Where is participant data stored?', 'What endpoints handle webhooks?')",
            },
            search_code: {
              type: "boolean",
              description: "Search source code for relevant snippets (default: true)",
              default: true,
            },
            search_api_docs: {
              type: "boolean",
              description: "Search API documentation for relevant endpoints/schemas (default: true)",
              default: true,
            },
            language: {
              type: "string",
              description: "Filter code search by language (e.g., 'php', 'javascript', 'typescript')",
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return",
              default: 10,
            },
          },
          required: ["question"],
        },
      },
      {
        name: "search_code",
        description: "Search source code across all AllDigitalRewards repositories. Returns matching files with code snippets.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Code search query (function names, class names, keywords, etc.)",
            },
            org: {
              type: "string",
              description: "GitHub organization",
              default: ORG_NAME,
            },
            language: {
              type: "string",
              description: "Filter by programming language (e.g., 'php', 'javascript', 'python')",
            },
            filename: {
              type: "string",
              description: "Filter by filename pattern",
            },
            extension: {
              type: "string",
              description: "Filter by file extension (e.g., 'php', 'ts', 'json')",
            },
            path: {
              type: "string",
              description: "Filter by path (e.g., 'src', 'app/Controllers')",
            },
            per_page: {
              type: "number",
              description: "Number of results (max 100)",
              default: 20,
            },
            include_snippets: {
              type: "boolean",
              description: "Include code snippets with context (slower but more useful)",
              default: true,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_api_docs",
        description: "Search the AllDigitalRewards Marketplace API documentation for endpoints and schemas matching your query.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'participant', 'webhook', 'transaction', 'points')",
            },
            swagger_url: {
              type: "string",
              description: "Custom Swagger/OpenAPI URL (defaults to ADR Marketplace API)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_code_snippet",
        description: "Get a specific code snippet from a file with surrounding context",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Repository name",
            },
            path: {
              type: "string",
              description: "File path within the repository",
            },
            search_term: {
              type: "string",
              description: "Term to search for and highlight in the file",
            },
            context_lines: {
              type: "number",
              description: "Number of lines of context around matches",
              default: 10,
            },
            org: {
              type: "string",
              description: "GitHub organization",
              default: ORG_NAME,
            },
          },
          required: ["repo", "path"],
        },
      },
      {
        name: "search_repos",
        description: "Search repositories in the AllDigitalRewards organization by name, topic, or keyword",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (repository name, keyword, or topic)",
            },
            org: {
              type: "string",
              description: "GitHub organization (defaults to alldigitalrewards)",
              default: ORG_NAME,
            },
            per_page: {
              type: "number",
              description: "Number of results per page (max 100)",
              default: 30,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_repos",
        description: "List all repositories in the AllDigitalRewards organization",
        inputSchema: {
          type: "object",
          properties: {
            org: {
              type: "string",
              description: "GitHub organization",
              default: ORG_NAME,
            },
            type: {
              type: "string",
              enum: ["all", "public", "private", "forks", "sources"],
              description: "Type of repositories to list",
              default: "all",
            },
            sort: {
              type: "string",
              enum: ["created", "updated", "pushed", "full_name"],
              description: "Sort field",
              default: "updated",
            },
            per_page: {
              type: "number",
              description: "Number of results per page",
              default: 30,
            },
          },
        },
      },
      {
        name: "get_repo_tree",
        description: "Get the file tree structure of a repository",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Repository name",
            },
            org: {
              type: "string",
              description: "GitHub organization",
              default: ORG_NAME,
            },
            branch: {
              type: "string",
              description: "Branch name (defaults to default branch)",
            },
            path: {
              type: "string",
              description: "Subdirectory path to focus on",
              default: "",
            },
          },
          required: ["repo"],
        },
      },
      {
        name: "get_file_content",
        description: "Get the content of a file from a repository",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Repository name",
            },
            path: {
              type: "string",
              description: "File path within the repository",
            },
            org: {
              type: "string",
              description: "GitHub organization",
              default: ORG_NAME,
            },
            branch: {
              type: "string",
              description: "Branch name (defaults to default branch)",
            },
          },
          required: ["repo", "path"],
        },
      },
      {
        name: "get_repo_metadata",
        description: "Get detailed metadata for a repository including topics, languages, and stats",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Repository name",
            },
            org: {
              type: "string",
              description: "GitHub organization",
              default: ORG_NAME,
            },
          },
          required: ["repo"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const org = args.org || ORG_NAME;

  try {
    switch (name) {
      case "ask": {
        const question = args.question;
        const searchCodeFlag = args.search_code !== false;
        const searchApiDocsFlag = args.search_api_docs !== false;
        const maxResults = args.max_results || 10;

        // Extract key terms from the question for searching
        const stopWords = new Set(['how', 'does', 'what', 'where', 'when', 'why', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        const terms = question.toLowerCase()
          .replace(/[?.,!]/g, '')
          .split(/\s+/)
          .filter(t => t.length > 2 && !stopWords.has(t));

        const searchQuery = terms.slice(0, 5).join(' ');

        const response = {
          question,
          search_terms: terms,
          code_results: [],
          api_results: { endpoints: [], schemas: [] },
          summary: ""
        };

        // Search source code
        if (searchCodeFlag && searchQuery) {
          try {
            const codeResults = await searchCode(searchQuery, org, {
              language: args.language,
              per_page: Math.min(maxResults, 15)
            });

            // Get snippets for top results
            const snippetPromises = codeResults.items.slice(0, 5).map(async (item) => {
              try {
                const snippetData = await getFileWithContext(
                  item.repository.owner.login,
                  item.repository.name,
                  item.path,
                  terms[0] || searchQuery,
                  5
                );
                return {
                  repo: item.repository.name,
                  path: item.path,
                  url: item.html_url,
                  snippets: snippetData.snippets.slice(0, 3)
                };
              } catch {
                return {
                  repo: item.repository.name,
                  path: item.path,
                  url: item.html_url,
                  snippets: []
                };
              }
            });

            response.code_results = await Promise.all(snippetPromises);
          } catch (e) {
            response.code_error = e.message;
          }
        }

        // Search API docs
        if (searchApiDocsFlag) {
          try {
            const apiSpec = await fetchApiDocs(args.swagger_url);
            const apiResults = searchApiDocs(apiSpec, question);
            response.api_results = {
              endpoints: apiResults.endpoints.slice(0, maxResults),
              schemas: apiResults.schemas.slice(0, 5)
            };
          } catch (e) {
            response.api_error = e.message;
          }
        }

        // Generate summary
        const codeCount = response.code_results.length;
        const endpointCount = response.api_results.endpoints.length;
        const schemaCount = response.api_results.schemas.length;

        response.summary = `Found ${codeCount} code file(s), ${endpointCount} API endpoint(s), and ${schemaCount} schema(s) relevant to your question.`;

        return {
          content: [{
            type: "text",
            text: JSON.stringify(response, null, 2)
          }]
        };
      }

      case "search_code": {
        const codeResults = await searchCode(args.query, org, {
          language: args.language,
          filename: args.filename,
          extension: args.extension,
          path: args.path,
          per_page: args.per_page || 20
        });

        let results = codeResults.items.map(item => ({
          repo: item.repository.name,
          path: item.path,
          url: item.html_url,
          score: item.score
        }));

        // Optionally include snippets
        if (args.include_snippets !== false) {
          const withSnippets = await Promise.all(
            results.slice(0, 10).map(async (item) => {
              try {
                const snippetData = await getFileWithContext(
                  org,
                  item.repo,
                  item.path,
                  args.query,
                  5
                );
                return { ...item, snippets: snippetData.snippets.slice(0, 3) };
              } catch {
                return item;
              }
            })
          );
          results = withSnippets;
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_count: codeResults.total_count,
              results
            }, null, 2)
          }]
        };
      }

      case "search_api_docs": {
        const spec = await fetchApiDocs(args.swagger_url);
        const results = searchApiDocs(spec, args.query);

        // Format endpoints with more detail
        const formattedEndpoints = results.endpoints.map(ep => ({
          method: ep.method,
          path: ep.path,
          summary: ep.summary,
          description: ep.description,
          tags: ep.tags
        }));

        // Format schemas with properties
        const formattedSchemas = results.schemas.map(s => ({
          name: s.name,
          description: s.description,
          properties: s.properties
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              api: spec.info?.title || "Unknown API",
              version: spec.info?.version,
              query: args.query,
              endpoints: formattedEndpoints,
              schemas: formattedSchemas
            }, null, 2)
          }]
        };
      }

      case "get_code_snippet": {
        const snippetData = await getFileWithContext(
          org,
          args.repo,
          args.path,
          args.search_term || "",
          args.context_lines || 10
        );

        // If no search term, return the whole file (first 200 lines)
        if (!args.search_term) {
          const data = await githubRequest(`/repos/${org}/${args.repo}/contents/${args.path}`);
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          const lines = content.split('\n').slice(0, 200);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                repo: args.repo,
                path: args.path,
                content: lines.map((line, i) => `${(i+1).toString().padStart(4)}: ${line}`).join('\n'),
                truncated: content.split('\n').length > 200
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              repo: args.repo,
              path: args.path,
              search_term: args.search_term,
              matches: snippetData.snippets.length,
              snippets: snippetData.snippets
            }, null, 2)
          }]
        };
      }

      case "search_repos": {
        const query = encodeURIComponent(`${args.query} org:${org}`);
        const perPage = args.per_page || 30;
        const data = await githubRequest(`/search/repositories?q=${query}&per_page=${perPage}`);

        const repos = data.items.map(repo => ({
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          updated_at: repo.updated_at,
          topics: repo.topics,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ total_count: data.total_count, repositories: repos }, null, 2),
            },
          ],
        };
      }

      case "list_repos": {
        const type = args.type || "all";
        const sort = args.sort || "updated";
        const perPage = args.per_page || 30;

        const data = await githubRequest(`/orgs/${org}/repos?type=${type}&sort=${sort}&per_page=${perPage}`);

        const repos = data.map(repo => ({
          name: repo.name,
          description: repo.description,
          private: repo.private,
          language: repo.language,
          topics: repo.topics,
          updated_at: repo.updated_at,
          default_branch: repo.default_branch,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ count: repos.length, repositories: repos }, null, 2),
            },
          ],
        };
      }

      case "get_repo_tree": {
        const repo = args.repo;
        let branch = args.branch;

        // Get default branch if not specified
        if (!branch) {
          const repoData = await githubRequest(`/repos/${org}/${repo}`);
          branch = repoData.default_branch;
        }

        const treeData = await githubRequest(`/repos/${org}/${repo}/git/trees/${branch}?recursive=1`);

        let items = treeData.tree;
        if (args.path) {
          items = items.filter(item => item.path.startsWith(args.path));
        }

        const tree = items.map(item => ({
          path: item.path,
          type: item.type,
          size: item.size,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ branch, tree }, null, 2),
            },
          ],
        };
      }

      case "get_file_content": {
        const repo = args.repo;
        const path = args.path;
        const branch = args.branch ? `?ref=${args.branch}` : "";

        const data = await githubRequest(`/repos/${org}/${repo}/contents/${path}${branch}`);

        if (data.type !== "file") {
          throw new Error(`Path ${path} is not a file`);
        }

        const content = Buffer.from(data.content, "base64").toString("utf-8");

        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }

      case "get_repo_metadata": {
        const repo = args.repo;

        const [repoData, languages, topics] = await Promise.all([
          githubRequest(`/repos/${org}/${repo}`),
          githubRequest(`/repos/${org}/${repo}/languages`),
          githubRequest(`/repos/${org}/${repo}/topics`),
        ]);

        const metadata = {
          name: repoData.name,
          full_name: repoData.full_name,
          description: repoData.description,
          url: repoData.html_url,
          private: repoData.private,
          default_branch: repoData.default_branch,
          created_at: repoData.created_at,
          updated_at: repoData.updated_at,
          pushed_at: repoData.pushed_at,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          open_issues: repoData.open_issues_count,
          languages,
          topics: topics.names,
          license: repoData.license?.name,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(metadata, null, 2),
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
  console.error("GitHub Repo API MCP server v2.0 running on stdio");
}

main().catch(console.error);
