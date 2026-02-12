/**
 * Parse dimension strings like 3' 3 1/4", 0' 8", 4' 0" into total inches.
 * Supports: feet (') and inches (") with optional fractional inches (e.g. 1/4, 1/2, 3/4).
 */
export function parseDimensionToInches(input: string): number {
  const s = String(input).trim();
  if (!s) return 0;

  let totalInches = 0;

  // Match feet: optional number + optional fraction, then '
  const feetMatch = s.match(/(\d+)\s*(?:\s+(\d+)\/(\d+))?\s*'/);
  if (feetMatch) {
    const whole = parseInt(feetMatch[1], 10) || 0;
    const num = feetMatch[2] ? parseInt(feetMatch[2], 10) : 0;
    const den = feetMatch[3] ? parseInt(feetMatch[3], 10) : 1;
    totalInches += whole * 12 + (den ? (num / den) * 12 : 0);
  }

  // Match inches: optional number + optional fraction, then "
  const inchMatch = s.match(/(\d+)\s*(?:\s+(\d+)\/(\d+))?\s*"/);
  if (inchMatch) {
    const whole = parseInt(inchMatch[1], 10) || 0;
    const num = inchMatch[2] ? parseInt(inchMatch[2], 10) : 0;
    const den = inchMatch[3] ? parseInt(inchMatch[3], 10) : 1;
    totalInches += whole + (den ? num / den : 0);
  }

  // Also support standalone number (interpret as inches) e.g. "8" or "8 1/2"
  if (totalInches === 0 && /^\d+(\s+\d+\/\d+)?$/.test(s)) {
    const parts = s.split(/\s+/);
    const whole = parseInt(parts[0], 10) || 0;
    if (parts[1] && parts[1].includes("/")) {
      const [n, d] = parts[1].split("/").map((x) => parseInt(x, 10));
      return whole + (d ? n / d : 0);
    }
    return whole;
  }

  return totalInches;
}
