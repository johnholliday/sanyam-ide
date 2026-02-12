# @sanyam/document-store

Cloud document storage service for Sanyam IDE using Supabase PostgreSQL.

## Purpose

This package provides cloud document storage capabilities for Sanyam IDE, enabling users to:
- Save DSL documents to cloud storage
- Retrieve and open cloud documents
- Manage document versions and history
- Handle document sharing between users

## Installation

```bash
pnpm add @sanyam/document-store
```

## Usage

### SupabaseClientFactory

Creates user-scoped Supabase clients for Row-Level Security (RLS) enforcement:

```typescript
import { SupabaseClientFactory } from '@sanyam/document-store';

// Get a user-scoped client (RLS enforced)
const client = clientFactory.createUserScopedClient(userAccessToken);

// Check online status
const isOnline = clientFactory.isOnline;
```

### CloudDocumentStore

CRUD operations for cloud documents:

```typescript
import { CloudDocumentStore } from '@sanyam/document-store';

// Create a document
const doc = await store.createDocument({
  name: 'my-model.ecml',
  languageId: 'ecml',
  content: 'model MyModel { ... }'
});

// Update with optimistic locking
const updated = await store.updateDocument(doc.id, {
  content: 'updated content'
}, doc.version);

// List user's documents
const documents = await store.listDocuments({ limit: 20 });
```

### UnifiedDocumentResolver

Resolves documents from cloud or local storage based on URI scheme:

```typescript
import { UnifiedDocumentResolver } from '@sanyam/document-store';

// Resolve sanyam:// URIs to cloud documents
const content = await resolver.resolve('sanyam://doc-id-here');

// Local file:// URIs handled transparently
const localContent = await resolver.resolve('file:///path/to/file.ecml');
```

## API Reference

### Interfaces

- `CloudDocument` - Document metadata and content
- `DocumentVersion` - Version history snapshot
- `DocumentShare` - Sharing permission grant

### Services

- `SupabaseClientFactory` - Creates RLS-aware Supabase clients
- `CloudDocumentStore` - Document CRUD operations
- `UnifiedDocumentResolver` - URI-based document resolution
- `DocumentCache` - In-memory caching with 5-minute TTL
- `AutoSaveService` - Automatic cloud save on idle

## Environment Variables

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

## License

MIT
