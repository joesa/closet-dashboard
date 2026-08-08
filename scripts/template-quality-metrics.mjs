export function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function summarizeLighthouse(samples) {
  return {
    accessibilityScore: Math.min(...samples.map((sample) => sample.accessibilityScore)),
    cls: median(samples.map((sample) => sample.cls)),
    lcp: median(samples.map((sample) => sample.lcp)),
    samples,
  }
}
