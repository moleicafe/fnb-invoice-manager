import { describe, it, expect } from 'vitest';
import { matchLocation } from '../src/lib/locations/match';

const locations = [
  { id: 'w', name: 'Woodlands 兀兰', aliases: ['wld', 'woodlands', '兀兰', '738343'] },
  { id: 'c', name: 'Chinese Garden 裕华园', aliases: ['chinese garden', '裕华园', 'boon lay way', '609959'] },
];

describe('matchLocation', () => {
  it('matches a branch code embedded in a customer ID (MY-WLDBAO)', () => {
    expect(matchLocation('MY-WLDBAO', locations)?.id).toBe('w');
  });
  it('matches a parenthesised code (WLD)', () => {
    expect(matchLocation('(WLD)', locations)?.id).toBe('w');
  });
  it('matches a Chinese branch name (兀兰地铁站 - 千味山东大包)', () => {
    expect(matchLocation('兀兰地铁站 - 千味山东大包', locations)?.id).toBe('w');
  });
  it('matches a delivery address line', () => {
    expect(matchLocation('30 Woodlands Avenue 2 #01-22 Singapore 738343', locations)?.id).toBe('w');
  });
  it('matches the Chinese Garden outlet via 裕华园', () => {
    expect(matchLocation('裕华园山东大包', locations)?.id).toBe('c');
  });
  it('matches the Chinese Garden outlet via its address', () => {
    expect(matchLocation('151 BOON LAY WAY #01-01 S609959', locations)?.id).toBe('c');
  });
  it('returns null when nothing matches', () => {
    expect(matchLocation('209 New Upper Changi Road', locations)).toBeNull();
  });
  it('returns null for null or blank hints', () => {
    expect(matchLocation(null, locations)).toBeNull();
    expect(matchLocation('  ', locations)).toBeNull();
  });
});
