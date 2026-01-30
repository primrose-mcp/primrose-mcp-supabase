# Supabase MCP Server

[![Primrose MCP](https://img.shields.io/badge/Primrose-MCP-blue)](https://primrose.dev/mcp/supabase)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

A Model Context Protocol (MCP) server for Supabase, enabling database operations, authentication, storage, and edge function management.

## Features

- **Database** - PostgreSQL database operations via PostgREST
- **Auth** - User authentication and management
- **Storage** - File storage and bucket management
- **Functions** - Edge function invocation

## Quick Start

### Recommended: Primrose SDK

The easiest way to use this MCP server is with the Primrose SDK:

```bash
npm install primrose-mcp
```

```typescript
import { PrimroseMCP } from 'primrose-mcp';

const client = new PrimroseMCP({
  server: 'supabase',
  credentials: {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
  }
});
```

### Manual Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy
   ```

## Configuration

### Required Headers

| Header | Description |
|--------|-------------|
| `X-Supabase-URL` | Supabase project URL (e.g., https://xxx.supabase.co) |
| `X-Supabase-Anon-Key` | Supabase anonymous key |

### Optional Headers

| Header | Description |
|--------|-------------|
| `X-Supabase-Service-Role-Key` | Service role key for admin operations |

## Available Tools

### Database
- `supabase_select` - Select data from a table
- `supabase_insert` - Insert records into a table
- `supabase_update` - Update records in a table
- `supabase_upsert` - Upsert records in a table
- `supabase_delete` - Delete records from a table
- `supabase_rpc` - Call a PostgreSQL function

### Auth
- `supabase_sign_up` - Create a new user
- `supabase_sign_in_password` - Sign in with email/password
- `supabase_sign_in_otp` - Sign in with magic link or OTP
- `supabase_sign_out` - Sign out a user
- `supabase_get_user` - Get current user details
- `supabase_update_user` - Update user metadata
- `supabase_reset_password` - Send password reset email
- `supabase_admin_list_users` - List all users (admin)
- `supabase_admin_create_user` - Create user (admin)
- `supabase_admin_delete_user` - Delete user (admin)

### Storage
- `supabase_list_buckets` - List storage buckets
- `supabase_get_bucket` - Get bucket details
- `supabase_create_bucket` - Create a new bucket
- `supabase_update_bucket` - Update bucket settings
- `supabase_delete_bucket` - Delete a bucket
- `supabase_empty_bucket` - Empty a bucket
- `supabase_list_files` - List files in a bucket
- `supabase_upload_file` - Upload a file
- `supabase_download_file` - Download a file
- `supabase_move_file` - Move/rename a file
- `supabase_copy_file` - Copy a file
- `supabase_delete_file` - Delete a file
- `supabase_get_public_url` - Get public URL for a file
- `supabase_create_signed_url` - Create signed URL

### Functions
- `supabase_invoke_function` - Invoke an edge function

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Type checking
npm run typecheck

# Deploy to Cloudflare
npm run deploy
```

## Related Resources

- [Primrose SDK Documentation](https://primrose.dev/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase API Reference](https://supabase.com/docs/reference)
- [Model Context Protocol](https://modelcontextprotocol.io/)
