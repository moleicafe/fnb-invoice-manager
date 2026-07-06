import { describe, it, expect } from 'vitest';
import { computeDueDate, hasArithmeticWarning } from '../src/lib/invoice/checks';

describe('computeDueDate', () => {
  it('adds the supplier terms to the invoice date', () => {
    expect(computeDueDate('2026-07-04', 30)).toBe('2026-08-03');
  });
  it('handles zero terms (cash / C.O.D.)', () => {
    expect(computeDueDate('2026-07-04', 0)).toBe('2026-07-04');
  });
  it('rolls over month and year ends', () => {
    expect(computeDueDate('2025-12-20', 14)).toBe('2026-01-03');
  });
  it('throws on an invalid date', () => {
    expect(() => computeDueDate('not-a-date', 30)).toThrow();
  });
});

describe('hasArithmeticWarning', () => {
  it('accepts subtotal + gst = total (EBUY sample: 8.50 + 0.77 = 9.27)', () => {
    expect(hasArithmeticWarning(8.5, 0.77, 9.27)).toBe(false);
  });
  it('flags a mismatch beyond S$0.05', () => {
    expect(hasArithmeticWarning(100, 9, 110)).toBe(true);
  });
  it('tolerates rounding within S$0.05', () => {
    expect(hasArithmeticWarning(100.0, 9.0, 109.04)).toBe(false);
  });
  it('treats missing GST as zero (non-GST supplier: subtotal = total)', () => {
    expect(hasArithmeticWarning(147.83, null, 147.83)).toBe(false);
  });
  it('never warns when subtotal or total is missing', () => {
    expect(hasArithmeticWarning(null, 5, 100)).toBe(false);
    expect(hasArithmeticWarning(100, 5, null)).toBe(false);
  });
});
