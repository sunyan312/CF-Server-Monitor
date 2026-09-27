import assert from 'node:assert/strict'
import test from 'node:test'
import { getRemoteVersion } from '../src/utils/version.js'

test('remote version checks stop waiting when response bodies stall', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: () => new Promise(() => {}) })
  try {
    const started = Date.now()
    assert.equal(await getRemoteVersion(), null)
    assert.ok(Date.now() - started < 3000)
  } finally {
    globalThis.fetch = originalFetch
  }
})
