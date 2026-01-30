/**
 * Response Formatting Utilities
 *
 * Helpers for formatting tool responses in JSON or Markdown.
 */

import type {
  AuthUser,
  PaginatedResponse,
  ResponseFormat,
  StorageBucket,
  StorageObject,
} from '../types/entities.js';
import { SupabaseApiError, formatErrorForLogging } from './errors.js';

/**
 * MCP tool response type
 * Note: Index signature required for MCP SDK 1.25+ compatibility
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Format a successful response
 */
export function formatResponse(
  data: unknown,
  format: ResponseFormat,
  entityType: string
): ToolResponse {
  if (format === 'markdown') {
    return {
      content: [{ type: 'text', text: formatAsMarkdown(data, entityType) }],
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format an error response
 */
export function formatError(error: unknown): ToolResponse {
  const errorInfo = formatErrorForLogging(error);

  let message: string;
  if (error instanceof SupabaseApiError) {
    message = `Error: ${error.message}`;
    if (error.retryable) {
      message += ' (retryable)';
    }
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Error: ${String(error)}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message, details: errorInfo }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Format data as Markdown
 */
function formatAsMarkdown(data: unknown, entityType: string): string {
  if (isPaginatedResponse(data)) {
    return formatPaginatedAsMarkdown(data, entityType);
  }

  if (Array.isArray(data)) {
    return formatArrayAsMarkdown(data, entityType);
  }

  if (typeof data === 'object' && data !== null) {
    return formatObjectAsMarkdown(data as Record<string, unknown>, entityType);
  }

  return String(data);
}

/**
 * Type guard for paginated response
 */
function isPaginatedResponse(data: unknown): data is PaginatedResponse<unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    Array.isArray((data as PaginatedResponse<unknown>).items)
  );
}

/**
 * Format paginated response as Markdown
 */
function formatPaginatedAsMarkdown(data: PaginatedResponse<unknown>, entityType: string): string {
  const lines: string[] = [];

  lines.push(`## ${capitalize(entityType)}`);
  lines.push('');

  if (data.total !== undefined) {
    lines.push(`**Total:** ${data.total} | **Showing:** ${data.count}`);
  } else {
    lines.push(`**Showing:** ${data.count}`);
  }

  if (data.hasMore) {
    lines.push('**More available:** Yes');
  }
  lines.push('');

  if (data.items.length === 0) {
    lines.push('_No items found._');
    return lines.join('\n');
  }

  // Format items based on entity type
  switch (entityType) {
    case 'users':
      lines.push(formatUsersTable(data.items as AuthUser[]));
      break;
    case 'buckets':
      lines.push(formatBucketsTable(data.items as StorageBucket[]));
      break;
    case 'objects':
      lines.push(formatObjectsTable(data.items as StorageObject[]));
      break;
    default:
      lines.push(formatGenericTable(data.items));
  }

  return lines.join('\n');
}

/**
 * Format auth users as Markdown table
 */
function formatUsersTable(users: AuthUser[]): string {
  const lines: string[] = [];
  lines.push('| ID | Email | Phone | Created | Last Sign In |');
  lines.push('|---|---|---|---|---|');

  for (const user of users) {
    lines.push(
      `| ${user.id} | ${user.email || '-'} | ${user.phone || '-'} | ${user.created_at || '-'} | ${user.last_sign_in_at || '-'} |`
    );
  }

  return lines.join('\n');
}

/**
 * Format storage buckets as Markdown table
 */
function formatBucketsTable(buckets: StorageBucket[]): string {
  const lines: string[] = [];
  lines.push('| ID | Name | Public | Size Limit | Created |');
  lines.push('|---|---|---|---|---|');

  for (const bucket of buckets) {
    const sizeLimit = bucket.file_size_limit
      ? `${Math.round(bucket.file_size_limit / 1024 / 1024)}MB`
      : 'None';
    lines.push(
      `| ${bucket.id} | ${bucket.name} | ${bucket.public ? 'Yes' : 'No'} | ${sizeLimit} | ${bucket.created_at || '-'} |`
    );
  }

  return lines.join('\n');
}

/**
 * Format storage objects as Markdown table
 */
function formatObjectsTable(objects: StorageObject[]): string {
  const lines: string[] = [];
  lines.push('| Name | Bucket | Created | Updated |');
  lines.push('|---|---|---|---|');

  for (const obj of objects) {
    lines.push(
      `| ${obj.name} | ${obj.bucket_id || '-'} | ${obj.created_at || '-'} | ${obj.updated_at || '-'} |`
    );
  }

  return lines.join('\n');
}

/**
 * Format a generic array as Markdown table
 */
function formatGenericTable(items: unknown[]): string {
  if (items.length === 0) return '_No items_';

  const first = items[0] as Record<string, unknown>;
  const keys = Object.keys(first).slice(0, 5); // Limit columns

  const lines: string[] = [];
  lines.push(`| ${keys.join(' | ')} |`);
  lines.push(`|${keys.map(() => '---').join('|')}|`);

  for (const item of items) {
    const record = item as Record<string, unknown>;
    const values = keys.map((k) => String(record[k] ?? '-'));
    lines.push(`| ${values.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Format an array as Markdown
 */
function formatArrayAsMarkdown(data: unknown[], entityType: string): string {
  switch (entityType) {
    case 'users':
      return formatUsersTable(data as AuthUser[]);
    case 'buckets':
      return formatBucketsTable(data as StorageBucket[]);
    case 'objects':
      return formatObjectsTable(data as StorageObject[]);
    default:
      return formatGenericTable(data);
  }
}

/**
 * Format a single object as Markdown
 */
function formatObjectAsMarkdown(data: Record<string, unknown>, entityType: string): string {
  const lines: string[] = [];
  lines.push(`## ${capitalize(entityType.replace(/s$/, ''))}`);
  lines.push('');

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object') {
      lines.push(`**${formatKey(key)}:**`);
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
    } else {
      lines.push(`**${formatKey(key)}:** ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a key for display (camelCase to Title Case)
 */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
