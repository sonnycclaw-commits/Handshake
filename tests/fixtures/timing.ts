/**
 * Timing measurement utilities for side-channel attack testing.
 * 
 * These helpers provide statistical analysis of timing measurements,
 * accounting for JavaScript runtime noise (JIT, GC, scheduling).
 */

export interface TimingMeasurement {
  /**
   * Arithmetic mean of the timing samples (nanoseconds)
   */
  mean: number

  /**
   * Standard deviation of the timing samples
   */
  stdDev: number

  /**
   * Minimum timing sample
   */
  min: number

  /**
   * Maximum timing sample
   */
  max: number

  /**
   * Raw timing samples (nanoseconds)
   */
  samples: number[]
}

/**
 * Analyzes timing samples for potential side-channel leaks.
 * Returns true if timing differences are statistically significant.
 */
export function detectTimingLeak(baseline: TimingMeasurement, comparison: TimingMeasurement): boolean {
  // Use 3-sigma threshold for statistical significance
  const threshold = 3 * Math.max(baseline.stdDev, comparison.stdDev)
  const difference = Math.abs(baseline.mean - comparison.mean)
  
  return difference > threshold
}

/**
 * Calculates timing measurement from raw samples.
 */
export function analyzeTiming(samples: number[]): TimingMeasurement {
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length
  const stdDev = Math.sqrt(variance)
  
  return {
    mean,
    stdDev,
    min: Math.min(...samples),
    max: Math.max(...samples),
    samples
  }
}

/**
 * Removes outliers from timing samples (beyond 3 sigma).
 */
export function removeOutliers(measurement: TimingMeasurement): TimingMeasurement {
  const threshold = 3 * measurement.stdDev
  const filtered = measurement.samples.filter(sample => 
    Math.abs(sample - measurement.mean) <= threshold
  )
  
  return analyzeTiming(filtered)
}

/**
 * Compares two timing distributions for statistical similarity.
 * Returns p-value from Mann-Whitney U test.
 */
export function compareTimingDistributions(a: TimingMeasurement, b: TimingMeasurement): number {
  // Implement Mann-Whitney U test
  // For now, use simple t-test approximation
  const pooledStdDev = Math.sqrt(
    (Math.pow(a.stdDev, 2) + Math.pow(b.stdDev, 2)) / 2
  )
  
  const t = Math.abs(a.mean - b.mean) / 
    (pooledStdDev * Math.sqrt(2 / a.samples.length))
  
  // Convert t-statistic to p-value (approximate)
  return 2 * (1 - normalCDF(Math.abs(t)))
}

/**
 * Normal cumulative distribution function.
 * Used for p-value calculation in timing comparisons.
 */
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)))
}

/**
 * Error function approximation.
 * Used for normal CDF calculation.
 */
function erf(x: number): number {
  const t = 1.0 / (1.0 + 0.5 * Math.abs(x))
  const tau = t * Math.exp(
    -x * x - 1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277)))))))))
  
  return x >= 0 ? 1 - tau : tau - 1
}