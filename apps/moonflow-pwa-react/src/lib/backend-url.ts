// src/lib/backend-url.ts — T98. The one server this app may ever talk to
// (ADR-053). Plain constant, no imports: build/csp.ts reads it too.
export const BACKEND_URL = 'https://moonflow.pockethost.io';
