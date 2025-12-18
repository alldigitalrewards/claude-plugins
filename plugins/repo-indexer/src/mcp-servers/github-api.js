#!/usr/bin/env node

/**
 * GitHub API MCP Server for AllDigitalRewards Repository Indexer
 *
 * Provides tools for searching, listing, and fetching repository data
 * from the AllDigitalRewards GitHub organization.
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

const server = new Server(
  {
    name: "github-repo-api",
    version: "1.0.0",
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
  console.error("GitHub Repo API MCP server running on stdio");
}

main().catch(console.error);
