# @sanyam/supabase-auth

Supabase authentication provider for Sanyam IDE with Theia integration.

## Purpose

This package provides authentication capabilities for Sanyam IDE, enabling:
- Sign-in via email/password, magic link, or OAuth (GitHub, Google, Azure AD)
- Session persistence across IDE restarts using Theia SecretStorage
- Automatic token refresh and propagation
- Dynamic auth provider discovery

## Installation

```bash
pnpm add @sanyam/supabase-auth
```

## Usage

### SupabaseAuthProvider

Implements Theia's `AuthenticationProvider` interface for Supabase Auth:

```typescript
import { SupabaseAuthProvider } from '@sanyam/supabase-auth';

// Get current sessions
const sessions = await authProvider.getSessions();

// Create a new session (triggers sign-in flow)
const session = await authProvider.createSession(['openid', 'email']);

// Sign out
await authProvider.removeSession(session.id);
```

### AuthStateEmitter

Observable authentication state for reactive updates:

```typescript
import { AuthStateEmitter, AuthState } from '@sanyam/supabase-auth';

emitter.onAuthStateChange((state: AuthState) => {
  switch (state.event) {
    case 'SIGNED_IN':
      console.log('User signed in:', state.session?.user);
      break;
    case 'SIGNED_OUT':
      console.log('User signed out');
      break;
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed');
      break;
  }
});
```

### AuthSessionStorage

Secure token storage using Theia SecretStorage:

```typescript
import { AuthSessionStorage } from '@sanyam/supabase-auth';

// Tokens are automatically encrypted by OS credential store
await storage.storeTokens(sessionId, {
  accessToken: 'eyJ...',
  refreshToken: 'eyJ...',
  expiresAt: Date.now() + 3600000
});

// Retrieve on startup
const tokens = await storage.getTokens(sessionId);
```

## API Reference

### Interfaces

- `AuthState` - Current authentication state
- `AuthSession` - Theia-compatible session object
- `OAuthConfig` - OAuth provider configuration

### Services

- `SupabaseAuthProvider` - Theia AuthenticationProvider implementation
- `AuthStateEmitter` - Observable auth state changes
- `AuthSessionStorage` - Encrypted token persistence
- `OAuthHandler` - Browser vs desktop OAuth flow handling

## Environment Variables

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SANYAM_AUTH_PROVIDERS=github,google,azure-ad
```

## OAuth Redirect Handling

- **Browser**: Standard redirect to configured callback URL
- **Desktop (Electron)**: Loopback redirect to localhost with dynamic port

## License

MIT
