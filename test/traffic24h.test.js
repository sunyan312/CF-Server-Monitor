import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateTraffic24h } from '../src/frontend/utils/traffic24h.js'

const now = Date.UTC(2026, 8, 27, 12)
const sample = (hoursAgo, rx, tx) => ({
  timestamp: now - hoursAgo * 60 * 60 * 1000,
  net_rx: rx,
  net_tx: tx
})

test('sums both directions inside the rolling 24-hour window', () => {
  const rows = [sample(25, 10, 20), sample(23, 100, 200), sample(1, 175, 260)]
  const current = { ...sample(0, 180, 270), last_updated: now }
  assert.deepEqual(calculateTraffic24h(rows, current, now), { rx: 80, tx: 70, total: 150 })
})

test('does not mistake an interface counter reset for traffic', () => {
  const rows = [sample(23, 950, 400), sample(12, 970, 420), sample(1, 8, 4)]
  assert.deepEqual(calculateTraffic24h(rows, null, now), { rx: 20, tx: 20, total: 40 })
})

test('ignores an unrelated monthly counter correction', () => {
  const rows = [
    { ...sample(2, 100, 200), net_rx_monthly: 500, net_tx_monthly: 600 },
    { ...sample(1, 110, 220), net_rx_monthly: 500_000, net_tx_monthly: 600_000 }
  ]
  assert.deepEqual(calculateTraffic24h(rows, null, now), { rx: 10, tx: 20, total: 30 })
})

test('does not append an older current status or show a total without two samples', () => {
  const rows = [sample(2, 100, 200), sample(1, 150, 250)]
  const oldStatus = { ...sample(3, 70, 170), last_updated: now - 3 * 60 * 60 * 1000 }
  assert.deepEqual(calculateTraffic24h(rows, oldStatus, now), { rx: 50, tx: 50, total: 100 })
  assert.equal(calculateTraffic24h([sample(1, 150, 250)], null, now), null)
})
