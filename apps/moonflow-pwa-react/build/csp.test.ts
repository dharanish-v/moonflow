import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, injectCsp } from './csp.ts';

describe('CSP', () => {
  it('forbids every network connection from the page', () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/connect-src 'none'/);
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
