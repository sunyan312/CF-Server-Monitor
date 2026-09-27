import assert from 'node:assert/strict'
import test from 'node:test'

import { serveFrontend } from '../src/handlers/frontend.js'

const dashboardHtml = '<!doctype html><html><head><title>Old</title><meta name="apiBase" content=""></head><body></body></html>'

const settings = {
  site_title: 'CFSM',
  favicon: '',
  csp_static: '',
  csp_api: 'https://extra.example',
  custom_head: '',
  custom_script: '',
  custom_bg: '',
  custom_bg_mobile: '',
  theme_url: ''
}

test('Workers API_BASE env is injected into frontend runtime config and CSP', async () => {
  const response = await serveFrontend(
    new Request('https://dashboard.example/'),
    {
      API_BASE: 'https://api-a.example, https://api-b.example/, http://invalid.example',
      ASSETS: {
        fetch: async () => new Response(dashboardHtml, {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        })
      }
    },
    settings
  )

  assert.equal(response.status, 200)

  const html = await response.text()
  assert.match(html, /<meta name="apiBase" content="https:\/\/api-a\.example,https:\/\/api-b\.example">/)
  assert.doesNotMatch(html, /http:\/\/invalid\.example/)

  const csp = response.headers.get('Content-Security-Policy') || ''
  assert.match(csp, /connect-src[^;]*https:\/\/api-a\.example/)
  assert.match(csp, /connect-src[^;]*wss:\/\/api-a\.example/)
  assert.match(csp, /connect-src[^;]*https:\/\/api-b\.example/)
  assert.match(csp, /connect-src[^;]*wss:\/\/api-b\.example/)
  assert.match(csp, /connect-src[^;]*https:\/\/extra\.example/)
  assert.match(csp, /connect-src[^;]*wss:\/\/extra\.example/)
})

test('configured local theme serves its bundled index and assets', async () => {
  const themeUrl = 'https://github.com/example/theme/tree/1234567890abcdef1234567890abcdef12345678'
  const paths = []
  const env = {
    LOCAL_THEME_URL: themeUrl,
    ASSETS: {
      fetch: async (request) => {
        const path = new URL(request.url).pathname
        paths.push(path)
        if (path === '/theme/index.html') {
          return new Response('<html><head></head><body><script src="/assets/app.js"></script></body></html>')
        }
        if (path === '/theme/assets/app.js') return new Response('console.log("local")')
        return new Response('not found', { status: 404 })
      }
    }
  }
  const themedSettings = { ...settings, theme_url: themeUrl }
  const html = await serveFrontend(new Request('https://dashboard.example/'), env, themedSettings)
  const asset = await serveFrontend(new Request('https://dashboard.example/assets/app.js'), env, themedSettings)

  assert.equal(html.status, 200)
  assert.match(await html.text(), /\/assets\/app\.js/)
  assert.equal(asset.status, 200)
  assert.equal(asset.headers.get('X-CFSM-Theme-Asset'), '1')
  assert.equal(await asset.text(), 'console.log("local")')
  assert.deepEqual(paths, ['/theme/index.html', '/theme/assets/app.js'])
})
