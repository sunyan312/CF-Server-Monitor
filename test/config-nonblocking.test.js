import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';
import { generateToken } from '../src/middleware/auth.js';

test('authenticated site config does not wait for GitHub version responses', async () => {
  const jwtSecret = '0123456789abcdef0123456789abcdef';
  const siteOptions = JSON.stringify({ jwt_secret: jwtSecret, is_public: 'true' });
  const db = {
    prepare(sql) {
      return {
        async first() {
          if (sql.includes("key = 'site_options'")) return { value: siteOptions };
          if (sql.includes("key = 'appearance_options'")) return { value: '{}' };
          return null;
        },
        async all() { return { results: [] }; }
      };
    }
  };
  const env = { API_SECRET: 'test-secret', CONFIG_DATABASE_READY: 'true', DB: db };
  const token = await generateToken(env, { jwt_secret: jwtSecret });
  const originalFetch = globalThis.fetch;
  const pendingBackground = [];
  globalThis.fetch = async () => new Response(new ReadableStream({
    start() { /* The remote server sends headers but never completes its body. */ }
  }), { status: 200 });

  try {
    const request = new Request('https://dashboard.example/api/config', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const response = await Promise.race([
      worker.fetch(request, env, { waitUntil: promise => pendingBackground.push(promise) }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('config waited for GitHub')), 500))
    ]);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).authorization, true);
    assert.equal(pendingBackground.length, 1);
    await Promise.allSettled(pendingBackground);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
