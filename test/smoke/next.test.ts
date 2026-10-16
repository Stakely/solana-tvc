// @jest-environment node
// next/server uses the Web Fetch API (Request) at module level, which jsdom 26 doesn't provide.
// We spawn a real Node.js process so the test runs with native globals available.
import { execSync } from 'node:child_process';

describe('next/server', () => {
  test('NextResponse is exported and its key static methods are callable', () => {
    const output = execSync(
      `node -e "
        const { NextResponse } = require('next/server');
        console.log(JSON.stringify({
          defined: typeof NextResponse !== 'undefined',
          json: typeof NextResponse.json,
          redirect: typeof NextResponse.redirect,
          rewrite: typeof NextResponse.rewrite,
        }));
      "`,
      { encoding: 'utf-8', cwd: process.cwd() }
    ).trim();

    const result = JSON.parse(output) as Record<string, unknown>;
    expect(result.defined).toBe(true);
    expect(result.json).toBe('function');
    expect(result.redirect).toBe('function');
    expect(result.rewrite).toBe('function');
  });
});

describe('next/server responses (src/core/arch/ArchResponse.ts)', () => {
  test('NextResponse.json and a raw NextResponse keep status, headers and body', () => {
    const output = execSync(
      `node -e "
        const { NextResponse } = require('next/server');
        (async () => {
          const json = NextResponse.json({ code: 'E', args: { a: 1 } }, { status: 409 });
          const html = new NextResponse('<p>ok</p>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
          console.log(JSON.stringify({
            jsonStatus: json.status,
            jsonType: json.headers.get('content-type'),
            jsonBody: await json.json(),
            htmlStatus: html.status,
            htmlType: html.headers.get('content-type'),
            htmlBody: await html.text(),
          }));
        })();
      "`,
      { encoding: 'utf-8', cwd: process.cwd() }
    ).trim();

    const result = JSON.parse(output) as Record<string, unknown>;
    expect(result.jsonStatus).toBe(409);
    expect(result.jsonType).toMatch(/application\/json/);
    expect(result.jsonBody).toEqual({ code: 'E', args: { a: 1 } });
    expect(result.htmlStatus).toBe(200);
    expect(result.htmlType).toMatch(/text\/html/);
    expect(result.htmlBody).toBe('<p>ok</p>');
  });
});
