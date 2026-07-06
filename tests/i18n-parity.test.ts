import { it, expect } from 'vitest';
import en from '../messages/en.json';
import zh from '../messages/zh-CN.json';

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? keyPaths(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

it('en and zh-CN have identical message keys', () => {
  expect(keyPaths(en).sort()).toEqual(keyPaths(zh).sort());
});
