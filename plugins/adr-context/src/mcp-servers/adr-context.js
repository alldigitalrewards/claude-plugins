#!/usr/bin/env node

/**
 * ADR Context v2.0 - AI-Powered Context7-style MCP Server
 *
 * Provides semantic search across ADR services, APIs, and code using
 * OpenAI embeddings for intelligent query understanding.
 *
 * Tools:
 * - resolve-service-id: AI-powered service discovery
 * - get-service-docs: RAG-enhanced documentation retrieval
 * - ask: Natural language questions about ADR codebase
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";

// ============================================================================
// Configuration
// ============================================================================

const GITHUB_API_URL = process.env.GITHUB_API_URL || "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ORG_NAME = process.env.ORG_NAME || "alldigitalrewards";
const SWAGGERHUB_URL = process.env.SWAGGERHUB_URL || "https://api.swaggerhub.com/apis/AllDigitalRewards/Marketplace/2.2";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const githubHeaders = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "ADR-Context-AI",
  ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
};

// Initialize OpenAI client
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ============================================================================
// In-Memory Vector Store
// ============================================================================

class VectorStore {
  constructor() {
    this.documents = [];
    this.embeddings = [];
  }

  async addDocument(doc, embedding) {
    this.documents.push(doc);
    this.embeddings.push(embedding);
  }

  async search(queryEmbedding, topK = 5) {
    if (this.embeddings.length === 0) return [];

    // Calculate cosine similarity
    const similarities = this.embeddings.map((emb, idx) => ({
      index: idx,
      score: this.cosineSimilarity(queryEmbedding, emb),
    }));

    // Sort by similarity and return top K
    similarities.sort((a, b) => b.score - a.score);
    return similarities.slice(0, topK).map((s) => ({
      document: this.documents[s.index],
      score: s.score,
    }));
  }

  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  clear() {
    this.documents = [];
    this.embeddings = [];
  }
}

// Global vector stores
const serviceStore = new VectorStore();
const docsStore = new VectorStore();
let isIndexed = false;

// ============================================================================
// AI Helpers
// ============================================================================

async function getEmbedding(text) {
  if (!openai) {
    // Fallback: simple TF-IDF-like embedding
    return simpleEmbedding(text);
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000), // Limit input length
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Embedding error:", error.message);
    return simpleEmbedding(text);
  }
}

// Simple fallback embedding (word frequency based)
function simpleEmbedding(text, dimensions = 256) {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const embedding = new Array(dimensions).fill(0);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % dimensions;
    }
    embedding[hash] += 1;
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
  return embedding.map((v) => v / norm);
}

async function generateAnswer(question, context) {
  if (!openai) {
    // Return context as-is without AI synthesis
    return {
      answer: "AI synthesis unavailable (no OPENAI_API_KEY). Here's the relevant context:",
      context,
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert on AllDigitalRewards (ADR) systems. Answer questions based on the provided context from ADR's codebase and API documentation. Be concise and include code examples when relevant.`,
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 1000,
    });

    return {
      answer: response.choices[0].message.content,
      context,
    };
  } catch (error) {
    return {
      answer: `AI error: ${error.message}. Here's the relevant context:`,
      context,
    };
  }
}

// ============================================================================
// GitHub API Helpers
// ============================================================================

async function githubRequest(endpoint) {
  const url = `${GITHUB_API_URL}${endpoint}`;
  const response = await fetch(url, { headers: githubHeaders });

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
    description: r.description || "",
    language: r.language,
    topics: r.topics || [],
    url: r.html_url,
    default_branch: r.default_branch,
  }));
}

async function fetchRepoContent(repo, path) {
  try {
    const data = await githubRequest(`/repos/${ORG_NAME}/${repo}/contents/${path}`);
    if (data.type === "file") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchRepoTree(repo) {
  try {
    const repoData = await githubRequest(`/repos/${ORG_NAME}/${repo}`);
    const treeData = await githubRequest(
      `/repos/${ORG_NAME}/${repo}/git/trees/${repoData.default_branch}?recursive=1`
    );
    return treeData.tree;
  } catch {
    return [];
  }
}

// ============================================================================
// API Documentation Helpers
// ============================================================================

async function fetchApiSpec(url = SWAGGERHUB_URL) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch API spec: ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// Indexing Functions
// ============================================================================

async function indexServices() {
  console.error("Indexing ADR services...");

  // Index API
  const apiDoc = {
    id: "marketplace-api",
    type: "api",
    name: "ADR Marketplace Platform API",
    description: "Core marketplace API for organizations, programs, participants, transactions, webhooks, SSO, and points management",
    topics: ["authentication", "organization", "program", "participant", "transaction", "webhook", "sso", "points"],
  };

  const apiText = `${apiDoc.name} ${apiDoc.description} ${apiDoc.topics.join(" ")}`;
  const apiEmbedding = await getEmbedding(apiText);
  await serviceStore.addDocument(apiDoc, apiEmbedding);

  // Index repositories
  const repos = await fetchOrgRepos();
  for (const repo of repos) {
    const text = `${repo.name} ${repo.description} ${repo.topics.join(" ")} ${repo.language || ""}`;
    const embedding = await getEmbedding(text);
    await serviceStore.addDocument({ ...repo, type: "repository" }, embedding);
  }

  console.error(`Indexed ${repos.length + 1} services`);
}

async function indexDocs() {
  console.error("Indexing documentation...");

  // Index API endpoints
  try {
    const spec = await fetchApiSpec();

    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;

        const doc = {
          type: "endpoint",
          method: method.toUpperCase(),
          path,
          summary: operation.summary || "",
          description: operation.description || "",
          tags: operation.tags || [],
          operationId: operation.operationId,
        };

        const text = `${method} ${path} ${doc.summary} ${doc.description} ${doc.tags.join(" ")}`;
        const embedding = await getEmbedding(text);
        await docsStore.addDocument(doc, embedding);
      }
    }

    // Index schemas
    const schemas = spec.components?.schemas || spec.definitions || {};
    for (const [name, schema] of Object.entries(schemas)) {
      const doc = {
        type: "schema",
        name,
        description: schema.description || "",
        properties: Object.keys(schema.properties || {}),
      };

      const text = `${name} ${doc.description} ${doc.properties.join(" ")}`;
      const embedding = await getEmbedding(text);
      await docsStore.addDocument(doc, embedding);
    }

    console.error(`Indexed ${Object.keys(spec.paths || {}).length} endpoints`);
  } catch (error) {
    console.error("API indexing error:", error.message);
  }

  // Index repo READMEs
  const repos = await fetchOrgRepos();
  for (const repo of repos.slice(0, 10)) {
    // Limit to top 10 repos
    const readme = await fetchRepoContent(repo.id, "README.md");
    if (readme) {
      const doc = {
        type: "readme",
        repo: repo.id,
        content: readme.slice(0, 2000),
      };

      const embedding = await getEmbedding(readme.slice(0, 4000));
      await docsStore.addDocument(doc, embedding);
    }
  }

  console.error("Documentation indexing complete");
}

async function ensureIndexed() {
  if (!isIndexed) {
    await indexServices();
    await indexDocs();
    isIndexed = true;
  }
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "adr-context",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "resolve-service-id",
        description:
          "AI-powered service discovery. Uses semantic search to find ADR services, APIs, and repositories " +
          "matching your query. Returns ranked results by relevance. Call this before 'get-service-docs'.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Natural language query to find services (e.g., 'user management', 'payment processing', 'webhook handling')",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get-service-docs",
        description:
          "RAG-enhanced documentation retrieval. Uses AI to find the most relevant documentation, " +
          "code examples, and API references for your query. Supports topic filtering.",
        inputSchema: {
          type: "object",
          properties: {
            serviceId: {
              type: "string",
              description: "Service ID from 'resolve-service-id' (e.g., 'marketplace-api', 'rewardstack-sdk')",
            },
            query: {
              type: "string",
              description: "What you want to know about this service (e.g., 'how to create webhooks', 'authentication flow')",
            },
            mode: {
              type: "string",
              enum: ["code", "info"],
              description: "Mode: 'code' for API/code examples, 'info' for conceptual docs",
              default: "code",
            },
          },
          required: ["serviceId"],
        },
      },
      {
        name: "ask",
        description:
          "Ask any question about the ADR codebase, APIs, or architecture. Uses RAG to find relevant " +
          "context and AI to synthesize a comprehensive answer with code examples.",
        inputSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description:
                "Your question about ADR systems (e.g., 'How does participant authentication work?', 'What webhook events are available?')",
            },
            maxResults: {
              type: "number",
              description: "Maximum number of context documents to retrieve",
              default: 5,
            },
          },
          required: ["question"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    await ensureIndexed();

    switch (name) {
      case "resolve-service-id": {
        const queryEmbedding = await getEmbedding(args.query);
        const results = await serviceStore.search(queryEmbedding, 10);

        const services = results.map((r) => ({
          id: r.document.id,
          type: r.document.type,
          name: r.document.name || r.document.id,
          description: r.document.description,
          relevance: Math.round(r.score * 100) / 100,
          topics: r.document.topics,
          language: r.document.language,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: args.query,
                  aiPowered: !!openai,
                  count: services.length,
                  services,
                  hint:
                    services.length > 0
                      ? `Use 'get-service-docs' with serviceId='${services[0].id}' and your specific question`
                      : "No matching services found. Try a different query.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get-service-docs": {
        const { serviceId, query, mode = "code" } = args;

        // Build search query
        const searchQuery = query ? `${serviceId} ${query}` : serviceId;
        const queryEmbedding = await getEmbedding(searchQuery);
        const results = await docsStore.search(queryEmbedding, 10);

        // Filter and format results
        const endpoints = results
          .filter((r) => r.document.type === "endpoint")
          .map((r) => ({
            ...r.document,
            relevance: Math.round(r.score * 100) / 100,
          }));

        const schemas = results
          .filter((r) => r.document.type === "schema")
          .map((r) => ({
            ...r.document,
            relevance: Math.round(r.score * 100) / 100,
          }));

        const readmes = results
          .filter((r) => r.document.type === "readme")
          .map((r) => ({
            repo: r.document.repo,
            excerpt: r.document.content.slice(0, 500),
            relevance: Math.round(r.score * 100) / 100,
          }));

        // Generate AI summary if available
        let aiSummary = null;
        if (openai && query) {
          const context = results
            .slice(0, 5)
            .map((r) => JSON.stringify(r.document))
            .join("\n\n");

          const answer = await generateAnswer(
            `For the ADR service "${serviceId}": ${query}`,
            context
          );
          aiSummary = answer.answer;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  serviceId,
                  query: query || "overview",
                  mode,
                  aiPowered: !!openai,
                  aiSummary,
                  documentation: {
                    endpoints: endpoints.slice(0, 10),
                    schemas: schemas.slice(0, 5),
                    readmes: readmes.slice(0, 3),
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "ask": {
        const { question, maxResults = 5 } = args;

        // Search both stores
        const queryEmbedding = await getEmbedding(question);
        const serviceResults = await serviceStore.search(queryEmbedding, 3);
        const docResults = await docsStore.search(queryEmbedding, maxResults);

        // Build context
        const contextParts = [];

        for (const r of serviceResults) {
          contextParts.push(`Service: ${r.document.name || r.document.id}\nDescription: ${r.document.description}`);
        }

        for (const r of docResults) {
          if (r.document.type === "endpoint") {
            contextParts.push(
              `API Endpoint: ${r.document.method} ${r.document.path}\nSummary: ${r.document.summary}\nDescription: ${r.document.description}`
            );
          } else if (r.document.type === "schema") {
            contextParts.push(
              `Schema: ${r.document.name}\nDescription: ${r.document.description}\nProperties: ${r.document.properties.join(", ")}`
            );
          } else if (r.document.type === "readme") {
            contextParts.push(`README (${r.document.repo}):\n${r.document.content.slice(0, 500)}`);
          }
        }

        const context = contextParts.join("\n\n---\n\n");

        // Generate answer
        const result = await generateAnswer(question, context);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  question,
                  aiPowered: !!openai,
                  answer: result.answer,
                  sources: {
                    services: serviceResults.map((r) => ({
                      id: r.document.id,
                      relevance: Math.round(r.score * 100) / 100,
                    })),
                    documents: docResults.map((r) => ({
                      type: r.document.type,
                      id: r.document.name || r.document.path || r.document.repo,
                      relevance: Math.round(r.score * 100) / 100,
                    })),
                  },
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
  console.error(`ADR Context v2.0 (AI-powered: ${!!openai}) running on stdio`);
}

main().catch(console.error);
