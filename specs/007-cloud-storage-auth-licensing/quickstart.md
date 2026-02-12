# Quickstart: Cloud Storage, Auth & Licensing Development

This guide covers setting up a local development environment for the cloud features.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (for local Supabase)
- Supabase CLI (`pnpm add -g supabase`)

## 1. Local Supabase Setup

### Start Local Supabase

```bash
# Initialize Supabase (first time only)
supabase init

# Start local Supabase stack
supabase start
```

This starts:
- PostgreSQL on `localhost:54322`
- Auth API on `localhost:54321`
- Studio UI at `http://localhost:54323`

### Get Local Credentials

```bash
supabase status
```

Output includes:
```
API URL: http://localhost:54321
anon key: eyJ...
service_role key: eyJ...
```

## 2. Environment Configuration

Create `.env.local` in repository root:

```bash
# Supabase (local development)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJ...  # From supabase status
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # From supabase status

# Auth mode
SANYAM_AUTH_MODE=supabase

# Default tier for new users
SANYAM_DEFAULT_TIER=free

# CORS (permissive for local dev)
SANYAM_CORS_ORIGIN=*

# OAuth providers (optional for local dev)
# SANYAM_AUTH_PROVIDERS=github,google
```

## 3. Run Database Migrations

```bash
# Apply migrations to local Supabase
supabase db push

# Or apply specific migration
supabase migration up
```

Migrations are in `supabase/migrations/`:
- `001_documents.sql` - Core schema (documents, versions, shares, api_keys, tier_limits)

### Seed Test Data

```bash
# Seed tier_limits with default values
supabase db reset  # Runs migrations + seed.sql
```

## 4. Build Packages

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Or build specific packages
pnpm build:extensions  # Theia extensions
pnpm build:language-server  # Language server (includes HTTP API)
```

## 5. Run Development Server

### Browser Mode

```bash
pnpm start:browser
```

Opens at `http://localhost:3002`

### Electron Mode

```bash
pnpm start:electron
```

## 6. Test Authentication Flow

### Browser Testing

1. Click "Sign In" in status bar
2. Select OAuth provider (or use email/password)
3. Complete OAuth flow
4. Verify session persists after page refresh

### API Testing

```bash
# Get a test token from Supabase Studio
# http://localhost:54323 > Authentication > Users > Create User

# Test API with token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/documents
```

## 7. Local OAuth Setup (Optional)

For OAuth providers in local development:

### GitHub OAuth App

1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create new app:
   - Homepage: `http://localhost:3002`
   - Callback: `http://localhost:54321/auth/v1/callback`
3. Add to Supabase:
   ```bash
   supabase functions secrets set GITHUB_CLIENT_ID=xxx
   supabase functions secrets set GITHUB_CLIENT_SECRET=xxx
   ```

### Google OAuth

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID:
   - Authorized origins: `http://localhost:3002`, `http://localhost:54321`
   - Authorized redirects: `http://localhost:54321/auth/v1/callback`
3. Add to Supabase via Studio UI (Authentication > Providers)

## 8. Testing Rate Limits

```bash
# Rapid requests to test rate limiting
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3001/api/v1/documents
done

# Should see 429 after exceeding tier limit
```

## 9. Testing Tier Limits

### Modify Tier via SQL

```sql
-- In Supabase Studio SQL Editor
UPDATE user_profiles
SET tier = 'pro'
WHERE email = 'test@example.com';
```

### Modify Tier Limits

```sql
-- Adjust free tier document limit for testing
UPDATE tier_limits
SET max_documents = 3
WHERE tier = 'free';
```

## 10. Troubleshooting

### Auth Token Issues

```bash
# Check token validity
curl http://localhost:54321/auth/v1/user \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

### RLS Policy Issues

```bash
# Test query as authenticated user (in Supabase Studio)
set request.jwt.claim.sub = 'user-uuid-here';
select * from documents;
```

### Migration Issues

```bash
# Reset database to clean state
supabase db reset

# Check migration status
supabase migration list
```

## Package Structure

After building, the cloud packages are:

```
packages/
├── document-store/      # @sanyam/document-store
├── supabase-auth/       # @sanyam/supabase-auth
└── licensing/           # @sanyam/licensing
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/documents` | GET | List documents |
| `/api/v1/documents` | POST | Create document |
| `/api/v1/documents/:id` | GET | Get document |
| `/api/v1/documents/:id` | PUT | Update document |
| `/api/v1/documents/:id` | DELETE | Soft-delete document |
| `/api/v1/documents/:id/restore` | POST | Restore from trash |
| `/api/v1/documents/:id/versions` | GET | List versions |
| `/api/v1/documents/:id/shares` | GET/POST | Manage shares |
| `/api/v1/api-keys` | GET/POST | Manage API keys |
| `/api/v1/webhooks/billing` | POST | Stripe webhook (stub) |

## Next Steps

1. Run the IDE and test sign-in flow
2. Create a test document and verify cloud storage
3. Test tier limits (document count, size)
4. Test document sharing (requires Pro tier)
5. Test version history (requires Pro tier)
