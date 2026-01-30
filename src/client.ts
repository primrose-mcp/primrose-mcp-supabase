/**
 * Supabase API Client
 *
 * This file handles all HTTP communication with the Supabase APIs.
 *
 * MULTI-TENANT: This client receives credentials per-request via TenantCredentials,
 * allowing a single server to serve multiple tenants with different projects.
 *
 * Supabase API Endpoints:
 * - REST/PostgREST: https://{project_ref}.supabase.co/rest/v1
 * - Auth: https://{project_ref}.supabase.co/auth/v1
 * - Storage: https://{project_ref}.supabase.co/storage/v1
 * - Edge Functions: https://{project_ref}.supabase.co/functions/v1
 */

import type {
  AuthUser,
  AuthUserCreateInput,
  AuthUserUpdateInput,
  EdgeFunction,
  PaginatedResponse,
  PaginationParams,
  StorageBucket,
  StorageBucketCreateInput,
  StorageObject,
  StorageSignedUrl,
} from './types/entities.js';
import type { TenantCredentials } from './types/env.js';
import {
  AuthenticationError,
  DatabaseError,
  RateLimitError,
  SupabaseApiError,
} from './utils/errors.js';

// =============================================================================
// Supabase Client Interface
// =============================================================================

export interface SupabaseClient {
  // Connection
  testConnection(): Promise<{ connected: boolean; message: string }>;

  // Database (PostgREST)
  selectFromTable(
    table: string,
    options?: {
      select?: string;
      filter?: string;
      order?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: unknown[]; count?: number }>;

  insertIntoTable(table: string, data: Record<string, unknown> | Record<string, unknown>[]): Promise<unknown[]>;

  updateTable(
    table: string,
    data: Record<string, unknown>,
    filter: string
  ): Promise<unknown[]>;

  deleteFromTable(table: string, filter: string): Promise<unknown[]>;

  upsertIntoTable(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ): Promise<unknown[]>;

  callRpcFunction(functionName: string, params?: Record<string, unknown>): Promise<unknown>;

  // Auth Admin
  listUsers(params?: PaginationParams): Promise<PaginatedResponse<AuthUser>>;
  getUser(userId: string): Promise<AuthUser>;
  createUser(input: AuthUserCreateInput): Promise<AuthUser>;
  updateUser(userId: string, input: AuthUserUpdateInput): Promise<AuthUser>;
  deleteUser(userId: string): Promise<void>;

  // Storage
  listBuckets(): Promise<StorageBucket[]>;
  getBucket(bucketId: string): Promise<StorageBucket>;
  createBucket(input: StorageBucketCreateInput): Promise<StorageBucket>;
  updateBucket(
    bucketId: string,
    input: Partial<StorageBucketCreateInput>
  ): Promise<StorageBucket>;
  deleteBucket(bucketId: string): Promise<void>;
  emptyBucket(bucketId: string): Promise<void>;

  listObjects(
    bucket: string,
    path?: string,
    options?: { limit?: number; offset?: number; search?: string }
  ): Promise<StorageObject[]>;

  getObject(bucket: string, path: string): Promise<Blob>;
  uploadObject(
    bucket: string,
    path: string,
    file: Blob | ArrayBuffer | string,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ path: string }>;

  moveObject(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<{ message: string }>;

  copyObject(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<{ path: string }>;

  deleteObjects(bucket: string, paths: string[]): Promise<{ name: string }[]>;

  createSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number
  ): Promise<StorageSignedUrl>;

  createSignedUploadUrl(
    bucket: string,
    path: string
  ): Promise<{ signedUrl: string; path: string; token: string }>;

  getPublicUrl(bucket: string, path: string): string;

  // Edge Functions
  listEdgeFunctions(): Promise<EdgeFunction[]>;
  invokeEdgeFunction(
    functionName: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      method?: string;
    }
  ): Promise<unknown>;
}

// =============================================================================
// Supabase Client Implementation
// =============================================================================

class SupabaseClientImpl implements SupabaseClient {
  private credentials: TenantCredentials;
  private baseUrl: string;

  constructor(credentials: TenantCredentials) {
    this.credentials = credentials;
    this.baseUrl = credentials.supabaseUrl || '';
  }

  // ===========================================================================
  // HTTP Request Helpers
  // ===========================================================================

  private getHeaders(preferReturn = true): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.credentials.anonKey || '',
      Authorization: `Bearer ${this.credentials.serviceRoleKey || this.credentials.anonKey || ''}`,
      'Content-Type': 'application/json',
    };

    if (preferReturn) {
      headers['Prefer'] = 'return=representation';
    }

    return headers;
  }

  private getAuthAdminHeaders(): Record<string, string> {
    if (!this.credentials.serviceRoleKey) {
      throw new AuthenticationError(
        'Service role key required for admin operations. Provide X-Supabase-Service-Role-Key header.'
      );
    }

    return {
      apikey: this.credentials.anonKey || '',
      Authorization: `Bearer ${this.credentials.serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    customHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(customHeaders || {}),
        ...(options.headers || {}),
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(
        'Rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) : 60
      );
    }

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(
        'Authentication failed. Check your API credentials.'
      );
    }

    // Handle other errors
    if (!response.ok) {
      const errorBody = await response.text();
      let message = `API error: ${response.status}`;
      let code: string | undefined;
      let hint: string | undefined;
      let details: string | undefined;

      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.message || errorJson.error || errorJson.msg || message;
        code = errorJson.code;
        hint = errorJson.hint;
        details = errorJson.details;
      } catch {
        // Use default message
      }

      if (code) {
        throw new DatabaseError(message, code, hint, details);
      }
      throw new SupabaseApiError(message, response.status);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return response.text() as unknown as T;
  }

  // ===========================================================================
  // Connection
  // ===========================================================================

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      // Try to access the REST API health
      await this.request('/rest/v1/', { method: 'GET' });
      return { connected: true, message: 'Successfully connected to Supabase' };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ===========================================================================
  // Database (PostgREST)
  // ===========================================================================

  async selectFromTable(
    table: string,
    options?: {
      select?: string;
      filter?: string;
      order?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: unknown[]; count?: number }> {
    const queryParams = new URLSearchParams();

    if (options?.select) {
      queryParams.set('select', options.select);
    }

    // Parse filter string into query params (e.g., "id=eq.1,name=like.*john*")
    if (options?.filter) {
      const filters = options.filter.split(',');
      for (const filter of filters) {
        const [key, value] = filter.split('=');
        if (key && value) {
          queryParams.set(key.trim(), value.trim());
        }
      }
    }

    if (options?.order) {
      queryParams.set('order', options.order);
    }

    if (options?.limit) {
      queryParams.set('limit', String(options.limit));
    }

    if (options?.offset) {
      queryParams.set('offset', String(options.offset));
    }

    const queryString = queryParams.toString();
    const endpoint = `/rest/v1/${table}${queryString ? `?${queryString}` : ''}`;

    const headers: Record<string, string> = {
      Prefer: 'count=exact',
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        ...this.getHeaders(false),
        ...headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `Database error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.message || errorJson.error || message;
        throw new DatabaseError(message, errorJson.code, errorJson.hint, errorJson.details);
      } catch (e) {
        if (e instanceof DatabaseError) throw e;
        throw new SupabaseApiError(message, response.status);
      }
    }

    const data = await response.json();
    const contentRange = response.headers.get('content-range');
    let count: number | undefined;

    if (contentRange) {
      const match = contentRange.match(/\/(\d+|\*)/);
      if (match && match[1] !== '*') {
        count = parseInt(match[1], 10);
      }
    }

    return { data: Array.isArray(data) ? data : [data], count };
  }

  async insertIntoTable(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<unknown[]> {
    const result = await this.request<unknown[]>(`/rest/v1/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return Array.isArray(result) ? result : [result];
  }

  async updateTable(
    table: string,
    data: Record<string, unknown>,
    filter: string
  ): Promise<unknown[]> {
    // Parse filter string into query params
    const queryParams = new URLSearchParams();
    const filters = filter.split(',');
    for (const f of filters) {
      const [key, value] = f.split('=');
      if (key && value) {
        queryParams.set(key.trim(), value.trim());
      }
    }

    const result = await this.request<unknown[]>(
      `/rest/v1/${table}?${queryParams.toString()}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );

    return Array.isArray(result) ? result : [result];
  }

  async deleteFromTable(table: string, filter: string): Promise<unknown[]> {
    // Parse filter string into query params
    const queryParams = new URLSearchParams();
    const filters = filter.split(',');
    for (const f of filters) {
      const [key, value] = f.split('=');
      if (key && value) {
        queryParams.set(key.trim(), value.trim());
      }
    }

    const result = await this.request<unknown[]>(
      `/rest/v1/${table}?${queryParams.toString()}`,
      {
        method: 'DELETE',
      }
    );

    return Array.isArray(result) ? result : result ? [result] : [];
  }

  async upsertIntoTable(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ): Promise<unknown[]> {
    const headers: Record<string, string> = {
      Prefer: 'resolution=merge-duplicates,return=representation',
    };

    let endpoint = `/rest/v1/${table}`;
    if (options?.onConflict) {
      endpoint += `?on_conflict=${options.onConflict}`;
    }

    const result = await this.request<unknown[]>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      headers
    );

    return Array.isArray(result) ? result : [result];
  }

  async callRpcFunction(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  // ===========================================================================
  // Auth Admin API
  // ===========================================================================

  async listUsers(params?: PaginationParams): Promise<PaginatedResponse<AuthUser>> {
    const queryParams = new URLSearchParams();

    if (params?.limit) {
      queryParams.set('per_page', String(params.limit));
    }
    if (params?.offset) {
      const page = Math.floor(params.offset / (params.limit || 20)) + 1;
      queryParams.set('page', String(page));
    }

    const queryString = queryParams.toString();
    const endpoint = `/auth/v1/admin/users${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<{ users: AuthUser[]; aud?: string }>(
      endpoint,
      { method: 'GET' },
      this.getAuthAdminHeaders()
    );

    const users = response.users || [];
    return {
      items: users,
      count: users.length,
      hasMore: users.length === (params?.limit || 20),
    };
  }

  async getUser(userId: string): Promise<AuthUser> {
    return this.request<AuthUser>(
      `/auth/v1/admin/users/${userId}`,
      { method: 'GET' },
      this.getAuthAdminHeaders()
    );
  }

  async createUser(input: AuthUserCreateInput): Promise<AuthUser> {
    return this.request<AuthUser>(
      '/auth/v1/admin/users',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      this.getAuthAdminHeaders()
    );
  }

  async updateUser(userId: string, input: AuthUserUpdateInput): Promise<AuthUser> {
    return this.request<AuthUser>(
      `/auth/v1/admin/users/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      this.getAuthAdminHeaders()
    );
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request<void>(
      `/auth/v1/admin/users/${userId}`,
      { method: 'DELETE' },
      this.getAuthAdminHeaders()
    );
  }

  // ===========================================================================
  // Storage API
  // ===========================================================================

  async listBuckets(): Promise<StorageBucket[]> {
    return this.request<StorageBucket[]>('/storage/v1/bucket', { method: 'GET' });
  }

  async getBucket(bucketId: string): Promise<StorageBucket> {
    return this.request<StorageBucket>(`/storage/v1/bucket/${bucketId}`, {
      method: 'GET',
    });
  }

  async createBucket(input: StorageBucketCreateInput): Promise<StorageBucket> {
    await this.request<{ name: string }>('/storage/v1/bucket', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    // Fetch the created bucket to return full details
    return this.getBucket(input.id);
  }

  async updateBucket(
    bucketId: string,
    input: Partial<StorageBucketCreateInput>
  ): Promise<StorageBucket> {
    await this.request<{ message: string }>(`/storage/v1/bucket/${bucketId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });

    return this.getBucket(bucketId);
  }

  async deleteBucket(bucketId: string): Promise<void> {
    await this.request<void>(`/storage/v1/bucket/${bucketId}`, {
      method: 'DELETE',
    });
  }

  async emptyBucket(bucketId: string): Promise<void> {
    await this.request<void>(`/storage/v1/bucket/${bucketId}/empty`, {
      method: 'POST',
    });
  }

  async listObjects(
    bucket: string,
    path = '',
    options?: { limit?: number; offset?: number; search?: string }
  ): Promise<StorageObject[]> {
    const body: Record<string, unknown> = {
      prefix: path,
    };

    if (options?.limit) {
      body.limit = options.limit;
    }
    if (options?.offset) {
      body.offset = options.offset;
    }
    if (options?.search) {
      body.search = options.search;
    }

    return this.request<StorageObject[]>(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getObject(bucket: string, path: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/storage/v1/object/${bucket}/${path}`,
      {
        method: 'GET',
        headers: this.getHeaders(false),
      }
    );

    if (!response.ok) {
      throw new SupabaseApiError(
        `Failed to get object: ${response.status}`,
        response.status
      );
    }

    return response.blob();
  }

  async uploadObject(
    bucket: string,
    path: string,
    file: Blob | ArrayBuffer | string,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ path: string }> {
    const headers: Record<string, string> = {
      ...this.getHeaders(false),
    };

    if (options?.contentType) {
      headers['Content-Type'] = options.contentType;
    } else if (file instanceof Blob) {
      headers['Content-Type'] = file.type || 'application/octet-stream';
    } else {
      headers['Content-Type'] = 'application/octet-stream';
    }

    if (options?.upsert) {
      headers['x-upsert'] = 'true';
    }

    const response = await fetch(
      `${this.baseUrl}/storage/v1/object/${bucket}/${path}`,
      {
        method: 'POST',
        headers,
        body: file,
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `Upload failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.message || errorJson.error || message;
      } catch {
        // Use default message
      }
      throw new SupabaseApiError(message, response.status);
    }

    return { path: `${bucket}/${path}` };
  }

  async moveObject(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<{ message: string }> {
    return this.request<{ message: string }>('/storage/v1/object/move', {
      method: 'POST',
      body: JSON.stringify({
        bucketId: bucket,
        sourceKey: fromPath,
        destinationKey: toPath,
      }),
    });
  }

  async copyObject(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<{ path: string }> {
    const result = await this.request<{ key: string }>('/storage/v1/object/copy', {
      method: 'POST',
      body: JSON.stringify({
        bucketId: bucket,
        sourceKey: fromPath,
        destinationKey: toPath,
      }),
    });

    return { path: result.key };
  }

  async deleteObjects(bucket: string, paths: string[]): Promise<{ name: string }[]> {
    return this.request<{ name: string }[]>(`/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: paths }),
    });
  }

  async createSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number
  ): Promise<StorageSignedUrl> {
    const result = await this.request<{ signedURL: string }>(
      `/storage/v1/object/sign/${bucket}/${path}`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresIn }),
      }
    );

    return {
      signedUrl: `${this.baseUrl}${result.signedURL}`,
      path: `${bucket}/${path}`,
    };
  }

  async createSignedUploadUrl(
    bucket: string,
    path: string
  ): Promise<{ signedUrl: string; path: string; token: string }> {
    const result = await this.request<{ url: string; token: string }>(
      `/storage/v1/object/upload/sign/${bucket}/${path}`,
      { method: 'POST' }
    );

    return {
      signedUrl: `${this.baseUrl}${result.url}`,
      path: `${bucket}/${path}`,
      token: result.token,
    };
  }

  getPublicUrl(bucket: string, path: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }

  // ===========================================================================
  // Edge Functions API
  // ===========================================================================

  async listEdgeFunctions(): Promise<EdgeFunction[]> {
    // Note: Listing edge functions requires the Management API
    // This endpoint returns functions deployed to the project
    return this.request<EdgeFunction[]>('/functions/v1/', { method: 'GET' });
  }

  async invokeEdgeFunction(
    functionName: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      method?: string;
    }
  ): Promise<unknown> {
    const response = await fetch(
      `${this.baseUrl}/functions/v1/${functionName}`,
      {
        method: options?.method || 'POST',
        headers: {
          ...this.getHeaders(false),
          ...(options?.headers || {}),
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `Function invocation failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.message || errorJson.error || message;
      } catch {
        message = errorBody || message;
      }
      throw new SupabaseApiError(message, response.status);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Supabase client instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides its own credentials via headers,
 * allowing a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
export function createSupabaseClient(credentials: TenantCredentials): SupabaseClient {
  return new SupabaseClientImpl(credentials);
}
