/**
 * Edge Functions Tools
 *
 * MCP tools for Supabase Edge Functions operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SupabaseClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all edge functions-related tools
 */
export function registerFunctionTools(server: McpServer, client: SupabaseClient): void {
  // ===========================================================================
  // Invoke Edge Function
  // ===========================================================================
  server.tool(
    'supabase_invoke_function',
    `Invoke a Supabase Edge Function.

Args:
  - functionName: Name of the edge function to invoke
  - body: Request body (will be JSON stringified)
  - method: HTTP method (default: POST)
  - headers: Additional headers to send

Returns:
  The function response.`,
    {
      functionName: z.string().describe('Function name'),
      body: z.unknown().optional().describe('Request body'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST').describe('HTTP method'),
      headers: z.record(z.string(), z.string()).optional().describe('Additional headers'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ functionName, body, method, headers, format }) => {
      try {
        const result = await client.invokeEdgeFunction(functionName, {
          body,
          method,
          headers,
        });
        return formatResponse(result, format, 'result');
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
