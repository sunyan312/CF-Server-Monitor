const WINDOW_MS = 24 * 60 * 60 * 1000

function counter(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function timestamp(value) {
  const number = typeof value === 'number' ? value : new Date(value).getTime()
  return Number.isFinite(number) ? number : null
}

function sumDeltas(samples, field) {
  let previous = null
  let total = 0
  for (const sample of samples) {
    const value = counter(sample[field])
    if (value === null) continue
    if (previous !== null) {
      // Interface counters may restart with the Agent or network interface.
      // A lower value is a reset, not traffic since the preceding sample.
      if (value >= previous) total += value - previous
    }
    previous = value
  }
  return total
}

export function calculateTraffic24h(rows, current, now = Date.now()) {
  const cutoff = now - WINDOW_MS
  const samples = (Array.isArray(rows) ? rows : [])
    .map(row => ({ ...row, time: timestamp(row.timestamp) }))
    .filter(row => row.time !== null && row.time >= cutoff && row.time <= now)
    .sort((a, b) => a.time - b.time)

  const currentTime = timestamp(current?.last_updated)
  if (currentTime !== null && currentTime >= cutoff && currentTime <= now &&
      (!samples.length || currentTime > samples[samples.length - 1].time)) {
    samples.push({ ...current, time: currentTime })
  }

  if (samples.length < 2) return null
  const rx = sumDeltas(samples, 'net_rx')
  const tx = sumDeltas(samples, 'net_tx')
  return { rx, tx, total: rx + tx }
}
