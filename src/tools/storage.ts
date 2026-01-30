/**
 * Storage Tools
 *
 * MCP tools for Supabase Storage operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SupabaseClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all storage-related tools
 */
export function registerStorageTools(server: McpServer, client: SupabaseClient): void {
  // ===========================================================================
  // List Buckets
  // ===========================================================================
  server.tool(
    'supabase_list_buckets',
    `List all storage buckets.

Returns:
  Array of bucket objects with their configuration.`,
    {
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ format }) => {
      try {
        const buckets = await client.listBuckets();
        return formatResponse(buckets, format, 'buckets');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Bucket
  // ===========================================================================
  server.tool(
    'supabase_get_bucket',
    `Get details of a specific storage bucket.

Args:
  - bucketId: The bucket ID/name

Returns:
  Bucket configuration details.`,
    {
      bucketId: z.string().describe('Bucket ID/name'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ bucketId, format }) => {
      try {
        const bucket = await client.getBucket(bucketId);
        return formatResponse(bucket, format, 'bucket');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Bucket
  // ===========================================================================
  server.tool(
    'supabase_create_bucket',
    `Create a new storage bucket.

Args:
  - id: Unique bucket ID/name
  - public: Whether the bucket is publicly accessible (default: false)
  - fileSizeLimit: Maximum file size in bytes
  - allowedMimeTypes: Array of allowed MIME types

Returns:
  The created bucket.`,
    {
      id: z.string().describe('Unique bucket ID'),
      public: z.boolean().default(false).describe('Publicly accessible'),
      fileSizeLimit: z.number().int().positive().optional().describe('Max file size in bytes'),
      allowedMimeTypes: z.array(z.string()).optional().describe('Allowed MIME types'),
    },
    async ({ id, public: isPublic, fileSizeLimit, allowedMimeTypes }) => {
      try {
        const bucket = await client.createBucket({
          id,
          public: isPublic,
          file_size_limit: fileSizeLimit,
          allowed_mime_types: allowedMimeTypes,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Bucket created', bucket }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update Bucket
  // ===========================================================================
  server.tool(
    'supabase_update_bucket',
    `Update a storage bucket's configuration.

Args:
  - bucketId: The bucket ID/name
  - public: Whether the bucket is publicly accessible
  - fileSizeLimit: Maximum file size in bytes
  - allowedMimeTypes: Array of allowed MIME types

Returns:
  The updated bucket.`,
    {
      bucketId: z.string().describe('Bucket ID'),
      public: z.boolean().optional().describe('Publicly accessible'),
      fileSizeLimit: z.number().int().positive().optional().describe('Max file size'),
      allowedMimeTypes: z.array(z.string()).optional().describe('Allowed MIME types'),
    },
    async ({ bucketId, public: isPublic, fileSizeLimit, allowedMimeTypes }) => {
      try {
        const bucket = await client.updateBucket(bucketId, {
          public: isPublic,
          file_size_limit: fileSizeLimit,
          allowed_mime_types: allowedMimeTypes,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Bucket updated', bucket }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Bucket
  // ===========================================================================
  server.tool(
    'supabase_delete_bucket',
    `Delete a storage bucket (must be empty).

Args:
  - bucketId: The bucket ID/name

Returns:
  Confirmation of deletion.`,
    {
      bucketId: z.string().describe('Bucket ID'),
    },
    async ({ bucketId }) => {
      try {
        await client.deleteBucket(bucketId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Bucket ${bucketId} deleted` }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Empty Bucket
  // ===========================================================================
  server.tool(
    'supabase_empty_bucket',
    `Remove all objects from a storage bucket.

Args:
  - bucketId: The bucket ID/name

Returns:
  Confirmation of operation.`,
    {
      bucketId: z.string().describe('Bucket ID'),
    },
    async ({ bucketId }) => {
      try {
        await client.emptyBucket(bucketId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Bucket ${bucketId} emptied` }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // List Objects
  // ===========================================================================
  server.tool(
    'supabase_list_objects',
    `List objects in a storage bucket.

Args:
  - bucket: The bucket ID/name
  - path: Folder path prefix (default: root)
  - limit: Maximum number of objects
  - offset: Objects to skip
  - search: Search string

Returns:
  Array of storage objects.`,
    {
      bucket: z.string().describe('Bucket ID'),
      path: z.string().default('').describe('Folder path'),
      limit: z.number().int().min(1).max(1000).optional().describe('Max objects'),
      offset: z.number().int().min(0).optional().describe('Objects to skip'),
      search: z.string().optional().describe('Search string'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ bucket, path, limit, offset, search, format }) => {
      try {
        const objects = await client.listObjects(bucket, path, { limit, offset, search });
        return formatResponse(objects, format, 'objects');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Upload Object
  // ===========================================================================
  server.tool(
    'supabase_upload_object',
    `Upload a file to storage (base64 encoded content).

Args:
  - bucket: The bucket ID/name
  - path: File path within the bucket
  - content: Base64 encoded file content
  - contentType: MIME type of the file
  - upsert: Overwrite if exists (default: false)

Returns:
  The upload path.`,
    {
      bucket: z.string().describe('Bucket ID'),
      path: z.string().describe('File path'),
      content: z.string().describe('Base64 encoded content'),
      contentType: z.string().default('application/octet-stream').describe('MIME type'),
      upsert: z.boolean().default(false).describe('Overwrite if exists'),
    },
    async ({ bucket, path, content, contentType, upsert }) => {
      try {
        // Decode base64 content
        const binaryString = atob(content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const result = await client.uploadObject(bucket, path, bytes.buffer, {
          contentType,
          upsert,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'File uploaded', ...result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Move Object
  // ===========================================================================
  server.tool(
    'supabase_move_object',
    `Move an object within storage.

Args:
  - bucket: The bucket ID/name
  - fromPath: Current file path
  - toPath: New file path

Returns:
  Confirmation of move.`,
    {
      bucket: z.string().describe('Bucket ID'),
      fromPath: z.string().describe('Current path'),
      toPath: z.string().describe('New path'),
    },
    async ({ bucket, fromPath, toPath }) => {
      try {
        const result = await client.moveObject(bucket, fromPath, toPath);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, ...result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Copy Object
  // ===========================================================================
  server.tool(
    'supabase_copy_object',
    `Copy an object within storage.

Args:
  - bucket: The bucket ID/name
  - fromPath: Source file path
  - toPath: Destination file path

Returns:
  The new file path.`,
    {
      bucket: z.string().describe('Bucket ID'),
      fromPath: z.string().describe('Source path'),
      toPath: z.string().describe('Destination path'),
    },
    async ({ bucket, fromPath, toPath }) => {
      try {
        const result = await client.copyObject(bucket, fromPath, toPath);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'File copied', ...result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Objects
  // ===========================================================================
  server.tool(
    'supabase_delete_objects',
    `Delete one or more objects from storage.

Args:
  - bucket: The bucket ID/name
  - paths: Array of file paths to delete

Returns:
  List of deleted files.`,
    {
      bucket: z.string().describe('Bucket ID'),
      paths: z.array(z.string()).describe('File paths to delete'),
    },
    async ({ bucket, paths }) => {
      try {
        const result = await client.deleteObjects(bucket, paths);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Files deleted', deleted: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Signed URL
  // ===========================================================================
  server.tool(
    'supabase_create_signed_url',
    `Create a signed URL for temporary access to a private file.

Args:
  - bucket: The bucket ID/name
  - path: File path
  - expiresIn: Expiration time in seconds (e.g., 3600 for 1 hour)

Returns:
  The signed URL.`,
    {
      bucket: z.string().describe('Bucket ID'),
      path: z.string().describe('File path'),
      expiresIn: z.number().int().min(1).describe('Expiration in seconds'),
    },
    async ({ bucket, path, expiresIn }) => {
      try {
        const result = await client.createSignedUrl(bucket, path, expiresIn);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Signed Upload URL
  // ===========================================================================
  server.tool(
    'supabase_create_signed_upload_url',
    `Create a signed URL for uploading a file.

Args:
  - bucket: The bucket ID/name
  - path: File path where the file will be uploaded

Returns:
  The signed upload URL and token.`,
    {
      bucket: z.string().describe('Bucket ID'),
      path: z.string().describe('File path'),
    },
    async ({ bucket, path }) => {
      try {
        const result = await client.createSignedUploadUrl(bucket, path);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Public URL
  // ===========================================================================
  server.tool(
    'supabase_get_public_url',
    `Get the public URL for a file in a public bucket.

Args:
  - bucket: The bucket ID/name (must be public)
  - path: File path

Returns:
  The public URL.`,
    {
      bucket: z.string().describe('Bucket ID'),
      path: z.string().describe('File path'),
    },
    async ({ bucket, path }) => {
      try {
        const url = client.getPublicUrl(bucket, path);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ url }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
