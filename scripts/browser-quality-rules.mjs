export const READING_MEASURE_RULE = Object.freeze({
  minimumProseCharacters: 82,
  maximumCharactersPerLine: 82,
})

export function isReadingMeasureViolation(textLength, estimatedCharacters, rule = READING_MEASURE_RULE) {
  return textLength > rule.minimumProseCharacters && estimatedCharacters > rule.maximumCharactersPerLine
}
