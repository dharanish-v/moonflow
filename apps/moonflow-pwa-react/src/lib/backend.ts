// src/lib/backend.ts — where API calls go. Always BACKEND_URL in the app;
// tests point it at a throwaway local PocketBase.
import { BACKEND_URL } from './backend-url';

let base = BACKEND_URL;

export function backendBase(): string {
  return base;
}

export function setBackendBaseForTests(url: string) {
  base = url;
}
