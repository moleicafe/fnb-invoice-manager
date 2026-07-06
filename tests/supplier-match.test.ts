import { describe, it, expect } from 'vitest';
import { normalizeSupplierName, diceCoefficient, matchSupplier } from '../src/lib/suppliers/match';

const suppliers = [
  { id: '1', name: 'Mega Packaging Plastic Pte Ltd', aliases: [] },
  { id: '2', name: 'DA DE FRESH PTE LTD', aliases: ['大德生鲜私人有限公司', '大德生鲜'] },
  { id: '3', name: 'Oh Chuan Aun Eggs Trading', aliases: [] },
];

describe('normalizeSupplierName', () => {
  it('lowercases and strips punctuation and legal suffixes', () => {
    expect(normalizeSupplierName('Mega Packaging Plastic Pte. Ltd.')).toBe('mega packaging plastic');
  });
  it('keeps Chinese characters', () => {
    expect(normalizeSupplierName('大德生鲜私人有限公司')).toBe('大德生鲜私人有限公司');
  });
});

describe('diceCoefficient', () => {
  it('is 1 for identical strings', () => {
    expect(diceCoefficient('abcd', 'abcd')).toBe(1);
  });
  it('is 0 for disjoint strings', () => {
    expect(diceCoefficient('abcd', 'wxyz')).toBe(0);
  });
});

describe('matchSupplier', () => {
  it('matches exactly ignoring case and suffixes', () => {
    expect(matchSupplier('MEGA PACKAGING PLASTIC PTE LTD', suppliers)?.id).toBe('1');
  });
  it('matches via a Chinese alias', () => {
    expect(matchSupplier('大德生鲜', suppliers)?.id).toBe('2');
  });
  it('matches close variants above the threshold', () => {
    expect(matchSupplier('Mega Packging Plastic', suppliers)?.id).toBe('1');
  });
  it('returns null when nothing is close', () => {
    expect(matchSupplier('Totally Different Trading', suppliers)).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(matchSupplier('', suppliers)).toBeNull();
  });
});
