import { describe, expect, it } from 'vitest';
import { BACKEND_URL } from '../src/lib/backend-url.ts';
import { CONTENT_SECURITY_POLICY, contentSecurityPolicy, injectCsp } from './csp.ts';

describe('CSP', () => {
  it('forbids every network connection from the page', () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/connect-src 'none'/);
  });

  it('with accounts on, allows the backend origin and nothing else (ADR-053)', () => {
    const csp = contentSecurityPolicy({ accounts: true });
    expect(csp).toContain(`connect-src ${BACKEND_URL};`);
    expect(BACKEND_URL).toMatch(/^https:\/\/[^/*\s]+$/);
    expect(csp.replace(`connect-src ${BACKEND_URL}`, "connect-src 'none'")).toBe(CONTENT_SECURITY_POLICY);
  });

  it('allows only same-origin scripts — no inline or third-party script', () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/script-src 'self'(;|$)/);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/script-src[^;]*unsafe/);
  });

  it('blocks forms, plugins and base-tag hijacking', () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/form-action 'none'/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/object-src 'none'/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/base-uri 'none'/);
  });

  it('is injected as the first tag in <head>', () => {
    const html = injectCsp('<html><head><meta charset="UTF-8" /><title>x</title></head></html>');
    expect(html).toMatch(/<head>\s*<meta http-equiv="Content-Security-Policy" content="[^"]+" \/>\s*<meta charset/);
  });
});
