// build/csp.ts — the Content-Security-Policy baked into both HTML entries at
// build time (T36). GitHub Pages can't send headers, so it's a <meta> tag.
//
// connect-src 'none' is the point: the page cannot make any network request
// at all (fetch, XHR, WebSocket, beacon), so "your data never leaves this
// phone" is enforced by the browser, not just promised. Service-worker
// precaching runs in the worker's own context and is unaffected.
//
// The one exception (ADR-053, T98): a build with accounts on may also reach
// BACKEND_URL — that origin and nothing else. Builds without accounts keep
// 'none'.
//
// Build-only (apply: 'build'): the Vite dev server needs a WebSocket for HMR.
import type { Plugin } from 'vite';
import { BACKEND_URL } from '../src/lib/backend-url.ts';

export function contentSecurityPolicy({ accounts = false } = {}): string {
  return policy(accounts ? BACKEND_URL : "'none'");
}

const policy = (connect: string) => [
  "default-src 'self'",
  "script-src 'self'",
  // Radix and vaul set inline styles; styles can't exfiltrate data
  // when connect-src and img-src are locked down.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connect}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const CONTENT_SECURITY_POLICY = contentSecurityPolicy();

export function injectCsp(html: string, csp = CONTENT_SECURITY_POLICY): string {
  return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
}

export function cspPlugin({ accounts = false } = {}): Plugin {
  const csp = contentSecurityPolicy({ accounts });
  return {
    name: 'moonflow-csp',
    apply: 'build',
    transformIndexHtml: (html) => injectCsp(html, csp),
  };
}
