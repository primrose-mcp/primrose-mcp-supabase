/**
 * Supabase Entity Types
 *
 * Standard data structures for Supabase entities.
 */

// =============================================================================
// Pagination
// =============================================================================

export interface PaginationParams {
  /** Number of items to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];
  /** Number of items in this response */
  count: number;
  /** Total count (if available) */
  total?: number;
  /** Whether more items are available */
  hasMore: boolean;
}

// =============================================================================
// Database (PostgREST)
// =============================================================================

export interface DatabaseQueryResult {
  data: unknown[] | null;
  error: DatabaseError | null;
  count?: number;
}

export interface DatabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// =============================================================================
// Auth
// =============================================================================

export interface AuthUser {
  id: string;
  aud: string;
  role?: string;
  email?: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
  confirmation_sent_at?: string;
  confirmed_at?: string;
  last_sign_in_at?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities?: AuthIdentity[];
  created_at: string;
  updated_at: string;
  is_anonymous?: boolean;
  banned_until?: string;
}

export interface AuthIdentity {
  id: string;
  user_id: string;
  identity_data: Record<string, unknown>;
  provider: string;
  last_sign_in_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUserCreateInput {
  email?: string;
  phone?: string;
  password?: string;
  email_confirm?: boolean;
  phone_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  ban_duration?: string;
}

export interface AuthUserUpdateInput {
  email?: string;
  phone?: string;
  password?: string;
  email_confirm?: boolean;
  phone_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  ban_duration?: string;
}

// =============================================================================
// Storage
// =============================================================================

export interface StorageBucket {
  id: string;
  name: string;
  owner?: string;
  public: boolean;
  file_size_limit?: number;
  allowed_mime_types?: string[];
  created_at: string;
  updated_at: string;
}

export interface StorageBucketCreateInput {
  id: string;
  name?: string;
  public?: boolean;
  file_size_limit?: number;
  allowed_mime_types?: string[];
}

export interface StorageObject {
  id?: string;
  name: string;
  bucket_id?: string;
  owner?: string;
  created_at?: string;
  updated_at?: string;
  last_accessed_at?: string;
  metadata?: Record<string, unknown>;
}

export interface StorageSignedUrl {
  signedUrl: string;
  path: string;
  token?: string;
}

// =============================================================================
// Edge Functions
// =============================================================================

export interface EdgeFunction {
  id: string;
  slug: string;
  name: string;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Realtime (Info only - subscription is client-side)
// =============================================================================

export interface RealtimeChannel {
  topic: string;
  type: 'broadcast' | 'presence' | 'postgres_changes';
}

// =============================================================================
// Response Format
// =============================================================================

export type ResponseFormat = 'json' | 'markdown';
