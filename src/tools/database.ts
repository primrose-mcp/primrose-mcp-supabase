/**
 * Database Tools
 *
 * MCP tools for Supabase PostgREST database operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SupabaseClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all database-related tools
 */
export function registerDatabaseTools(server: McpServer, client: SupabaseClient): void {
  // ===========================================================================
  // Select from Table
  // ===========================================================================
  server.tool(
    'supabase_select',
    `Select data from a Supabase table using PostgREST.

Args:
  - table: The table name to query
  - select: Columns to select (e.g., "id,name,email" or "*")
  - filter: PostgREST filter string (e.g., "id=eq.1,status=eq.active")
  - order: Order by clause (e.g., "created_at.desc")
  - limit: Maximum number of rows to return
  - offset: Number of rows to skip

Filter operators:
  - eq: Equal (e.g., "status=eq.active")
  - neq: Not equal
  - gt, gte, lt, lte: Greater/less than
  - like, ilike: Pattern matching (e.g., "name=like.*john*")
  - in: In list (e.g., "id=in.(1,2,3)")
  - is: Is null/not null (e.g., "deleted_at=is.null")

Returns:
  Array of matching rows with optional count.`,
    {
      table: z.string().describe('Table name to query'),
      select: z.string().optional().default('*').describe('Columns to select'),
      filter: z.string().optional().describe('PostgREST filter string'),
      order: z.string().optional().describe('Order by clause'),
      limit: z.number().int().min(1).max(1000).optional().describe('Max rows to return'),
      offset: z.number().int().min(0).optional().describe('Rows to skip'),
      format: z.enum(['json', 'markdown']).default('json').describe('Response format'),
    },
    async ({ table, select, filter, order, limit, offset, format }) => {
      try {
        const result = await client.selectFromTable(table, {
          select,
          filter,
          order,
          limit,
          offset,
        });
        return formatResponse(result, format, 'rows');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Insert into Table
  // ===========================================================================
  server.tool(
    'supabase_insert',
    `Insert data into a Supabase table.

Args:
  - table: The table name
  - data: Object or array of objects to insert

Returns:
  The inserted row(s).`,
    {
      table: z.string().describe('Table name'),
      data: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]).describe('Data to insert'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ table, data, format }) => {
      try {
        const result = await client.insertIntoTable(table, data);
        return formatResponse(
          { success: true, message: 'Data inserted', data: result },
          format,
          'result'
        );
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update Table
  // ===========================================================================
  server.tool(
    'supabase_update',
    `Update data in a Supabase table.

Args:
  - table: The table name
  - data: Object with fields to update
  - filter: PostgREST filter to identify rows (e.g., "id=eq.1")

Returns:
  The updated row(s).`,
    {
      table: z.string().describe('Table name'),
      data: z.record(z.string(), z.unknown()).describe('Fields to update'),
      filter: z.string().describe('PostgREST filter string'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ table, data, filter, format }) => {
      try {
        const result = await client.updateTable(table, data, filter);
        return formatResponse(
          { success: true, message: 'Data updated', data: result },
          format,
          'result'
        );
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete from Table
  // ===========================================================================
  server.tool(
    'supabase_delete',
    `Delete data from a Supabase table.

Args:
  - table: The table name
  - filter: PostgREST filter to identify rows (e.g., "id=eq.1")

Returns:
  The deleted row(s).`,
    {
      table: z.string().describe('Table name'),
      filter: z.string().describe('PostgREST filter string'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ table, filter, format }) => {
      try {
        const result = await client.deleteFromTable(table, filter);
        return formatResponse(
          { success: true, message: 'Data deleted', data: result },
          format,
          'result'
        );
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Upsert into Table
  // ===========================================================================
  server.tool(
    'supabase_upsert',
    `Upsert (insert or update) data in a Supabase table.

Args:
  - table: The table name
  - data: Object or array of objects to upsert
  - onConflict: Column(s) to check for conflicts (e.g., "id" or "email,org_id")

Returns:
  The upserted row(s).`,
    {
      table: z.string().describe('Table name'),
      data: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]).describe('Data to upsert'),
      onConflict: z.string().optional().describe('Conflict column(s)'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ table, data, onConflict, format }) => {
      try {
        const result = await client.upsertIntoTable(table, data, { onConflict });
        return formatResponse(
          { success: true, message: 'Data upserted', data: result },
          format,
          'result'
        );
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Call RPC Function
  // ===========================================================================
  server.tool(
    'supabase_rpc',
    `Call a Postgres function (RPC) in Supabase.

Args:
  - functionName: Name of the function to call
  - params: Object with function parameters

Returns:
  The function result.`,
    {
      functionName: z.string().describe('Function name'),
      params: z.record(z.string(), z.unknown()).optional().describe('Function parameters'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ functionName, params, format }) => {
      try {
        const result = await client.callRpcFunction(functionName, params);
        return formatResponse(result, format, 'result');
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
