export function money(n) {
  const v = Math.round(n)
  const sign = v < 0 ? '−' : ''
  return sign + '₱' + Math.abs(v).toLocaleString('en-US')
}

export function money2(n) {
  const sign = n < 0 ? '−' : ''
  return sign + '₱' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function pct(n, digits = 0) {
  return (n * 100).toFixed(digits) + '%'
}

export function parseNum(raw) {
  const v = parseInt(String(raw).replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(v) ? v : 0
}
