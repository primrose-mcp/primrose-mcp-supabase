/**
 * Supabase MCP Server - Main Entry Point
 *
 * This file sets up the MCP server using Cloudflare's Agents SDK.
 * It supports stateless mode for multi-tenant deployments.
 *
 * MULTI-TENANT ARCHITECTURE:
 * Tenant credentials (Supabase URL and keys) are parsed from request headers,
 * allowing a single server deployment to serve multiple customers.
 *
 * Required Headers:
 * - X-Supabase-URL: Supabase project URL (e.g., https://xxx.supabase.co)
 * - X-Supabase-Anon-Key: Supabase anonymous key
 *
 * Optional Headers:
 * - X-Supabase-Service-Role-Key: Service role key for admin operations
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { createSupabaseClient } from './client.js';
import { registerAuthTools } from './tools/auth.js';
import { registerDatabaseTools } from './tools/database.js';
import { registerFunctionTools } from './tools/functions.js';
import { registerStorageTools } from './tools/storage.js';
import {
  type Env,
  type TenantCredentials,
  parseTenantCredentials,
  validateCredentials,
} from './types/env.js';

// =============================================================================
// MCP Server Configuration
// =============================================================================

const SERVER_NAME = 'primrose-mcp-supabase';
const SERVER_VERSION = '1.0.0';

// =============================================================================
// MCP Agent (Stateful - uses Durable Objects)
// =============================================================================

/**
 * McpAgent provides stateful MCP sessions backed by Durable Objects.
 *
 * NOTE: For multi-tenant deployments, use the stateless mode (Option 2) instead.
 *
 * @deprecated For multi-tenant support, use stateless mode with per-request credentials
 */
export class SupabaseMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  async init() {
    throw new Error(
      'Stateful mode (McpAgent) is not supported for multi-tenant deployments. ' +
        'Use the stateless /mcp endpoint with X-Supabase-URL and X-Supabase-Anon-Key headers instead.'
    );
  }
}

// =============================================================================
// Stateless MCP Server (Recommended - no Durable Objects needed)
// =============================================================================

/**
 * Creates a stateless MCP server instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides credentials via headers, allowing
 * a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
function createStatelessServer(credentials: TenantCredentials): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Create client with tenant-specific credentials
  const client = createSupabaseClient(credentials);

  // Register all tools
  registerDatabaseTools(server, client);
  registerAuthTools(server, client);
  registerStorageTools(server, client);
  registerFunctionTools(server, client);

  // Test connection tool
  server.tool(
    'supabase_test_connection',
    'Test the connection to the Supabase project',
    {},
    async () => {
      try {
        const result = await client.testConnection();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// =============================================================================
// Worker Export
// =============================================================================

export default {
  /**
   * Main fetch handler for the Worker
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', server: SERVER_NAME }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ==========================================================================
    // Stateless MCP with Streamable HTTP (Recommended for multi-tenant)
    // ==========================================================================
    if (url.pathname === '/mcp' && request.method === 'POST') {
      // Parse tenant credentials from request headers
      const credentials = parseTenantCredentials(request);

      // Validate credentials are present
      try {
        validateCredentials(credentials);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Invalid credentials',
            required_headers: ['X-Supabase-URL', 'X-Supabase-Anon-Key'],
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Create server with tenant-specific credentials
      const server = createStatelessServer(credentials);

      // Import and use createMcpHandler for streamable HTTP
      const { createMcpHandler } = await import('agents/mcp');
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    // SSE endpoint for legacy clients
    if (url.pathname === '/sse') {
      return new Response('SSE endpoint requires Durable Objects. Enable in wrangler.jsonc.', {
        status: 501,
      });
    }

    // Default response
    return new Response(
      JSON.stringify({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: 'Multi-tenant Supabase MCP Server',
        endpoints: {
          mcp: '/mcp (POST) - Streamable HTTP MCP endpoint',
          health: '/health - Health check',
        },
        authentication: {
          description: 'Pass tenant credentials via request headers',
          required_headers: {
            'X-Supabase-URL': 'Your Supabase project URL (e.g., https://xxx.supabase.co)',
            'X-Supabase-Anon-Key': 'Your Supabase anonymous key',
          },
          optional_headers: {
            'X-Supabase-Service-Role-Key': 'Service role key for admin operations (auth admin, etc.)',
          },
        },
        tools: {
          database: [
            'supabase_select',
            'supabase_insert',
            'supabase_update',
            'supabase_delete',
            'supabase_upsert',
            'supabase_rpc',
          ],
          auth: [
            'supabase_list_users',
            'supabase_get_user',
            'supabase_create_user',
            'supabase_update_user',
            'supabase_delete_user',
          ],
          storage: [
            'supabase_list_buckets',
            'supabase_get_bucket',
            'supabase_create_bucket',
            'supabase_update_bucket',
            'supabase_delete_bucket',
            'supabase_empty_bucket',
            'supabase_list_objects',
            'supabase_upload_object',
            'supabase_move_object',
            'supabase_copy_object',
            'supabase_delete_objects',
            'supabase_create_signed_url',
            'supabase_create_signed_upload_url',
            'supabase_get_public_url',
          ],
          functions: ['supabase_invoke_function'],
          utility: ['supabase_test_connection'],
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
