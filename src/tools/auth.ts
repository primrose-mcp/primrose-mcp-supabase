/**
 * Auth Tools
 *
 * MCP tools for Supabase Auth Admin operations.
 * Note: These operations require the service role key.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SupabaseClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all auth-related tools
 */
export function registerAuthTools(server: McpServer, client: SupabaseClient): void {
  // ===========================================================================
  // List Users
  // ===========================================================================
  server.tool(
    'supabase_list_users',
    `List auth users from Supabase (requires service role key).

Args:
  - limit: Number of users to return (default: 20)
  - offset: Number of users to skip

Returns:
  Paginated list of users with their metadata.`,
    {
      limit: z.number().int().min(1).max(100).default(20).describe('Number of users to return'),
      offset: z.number().int().min(0).optional().describe('Users to skip'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ limit, offset, format }) => {
      try {
        const result = await client.listUsers({ limit, offset });
        return formatResponse(result, format, 'users');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get User
  // ===========================================================================
  server.tool(
    'supabase_get_user',
    `Get a single auth user by ID (requires service role key).

Args:
  - userId: The user's UUID

Returns:
  The user record with all metadata.`,
    {
      userId: z.string().uuid().describe('User UUID'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ userId, format }) => {
      try {
        const user = await client.getUser(userId);
        return formatResponse(user, format, 'user');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create User
  // ===========================================================================
  server.tool(
    'supabase_create_user',
    `Create a new auth user (requires service role key).

Args:
  - email: User's email address
  - password: User's password (optional for passwordless)
  - phone: User's phone number
  - emailConfirm: Auto-confirm email (default: false)
  - phoneConfirm: Auto-confirm phone (default: false)
  - userMetadata: Custom user metadata
  - appMetadata: App-specific metadata

Returns:
  The created user record.`,
    {
      email: z.string().email().optional().describe('Email address'),
      password: z.string().min(6).optional().describe('Password (min 6 chars)'),
      phone: z.string().optional().describe('Phone number'),
      emailConfirm: z.boolean().default(false).describe('Auto-confirm email'),
      phoneConfirm: z.boolean().default(false).describe('Auto-confirm phone'),
      userMetadata: z.record(z.string(), z.unknown()).optional().describe('User metadata'),
      appMetadata: z.record(z.string(), z.unknown()).optional().describe('App metadata'),
    },
    async ({ email, password, phone, emailConfirm, phoneConfirm, userMetadata, appMetadata }) => {
      try {
        const user = await client.createUser({
          email,
          password,
          phone,
          email_confirm: emailConfirm,
          phone_confirm: phoneConfirm,
          user_metadata: userMetadata,
          app_metadata: appMetadata,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'User created', user }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update User
  // ===========================================================================
  server.tool(
    'supabase_update_user',
    `Update an existing auth user (requires service role key).

Args:
  - userId: The user's UUID
  - email: New email address
  - password: New password
  - phone: New phone number
  - emailConfirm: Confirm email
  - phoneConfirm: Confirm phone
  - userMetadata: Updated user metadata
  - appMetadata: Updated app metadata
  - banDuration: Ban duration (e.g., "24h", "7d", "none" to unban)

Returns:
  The updated user record.`,
    {
      userId: z.string().uuid().describe('User UUID'),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      phone: z.string().optional(),
      emailConfirm: z.boolean().optional(),
      phoneConfirm: z.boolean().optional(),
      userMetadata: z.record(z.string(), z.unknown()).optional(),
      appMetadata: z.record(z.string(), z.unknown()).optional(),
      banDuration: z.string().optional().describe('Ban duration (e.g., "24h") or "none" to unban'),
    },
    async ({ userId, email, password, phone, emailConfirm, phoneConfirm, userMetadata, appMetadata, banDuration }) => {
      try {
        const user = await client.updateUser(userId, {
          email,
          password,
          phone,
          email_confirm: emailConfirm,
          phone_confirm: phoneConfirm,
          user_metadata: userMetadata,
          app_metadata: appMetadata,
          ban_duration: banDuration,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'User updated', user }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete User
  // ===========================================================================
  server.tool(
    'supabase_delete_user',
    `Delete an auth user (requires service role key).

Args:
  - userId: The user's UUID

Returns:
  Confirmation of deletion.`,
    {
      userId: z.string().uuid().describe('User UUID'),
    },
    async ({ userId }) => {
      try {
        await client.deleteUser(userId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `User ${userId} deleted` }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
