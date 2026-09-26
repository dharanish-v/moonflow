// build/csp.ts — the Content-Security-Policy baked into both HTML entries at
// build time (T36). GitHub Pages can't send headers, so it's a <meta> tag.
//
// connect-src 'none' is the point: the page cannot make any network request
// at all (fetch, XHR, WebSocket, beacon), so "your data never leaves this
// phone" is enforced by the browser, not just promised. Service-worker
// precaching runs in the worker's own context and is unaffected.
//
// Build-only (apply: 'build'): the Vite dev server needs a WebSocket for HMR.
import type { Plugin } from 'vite';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Radix and vaul set inline styles; styles can't exfiltrate data
  // when connect-src and img-src are locked down.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export function injectCsp(html: string): string {
  return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`);
}

export function cspPlugin(): Plugin {
  return {
    name: 'moonflow-csp',
    apply: 'build',
    transformIndexHtml: (html) => injectCsp(html),
  };
}
