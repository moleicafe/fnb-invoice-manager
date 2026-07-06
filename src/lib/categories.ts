export const CATEGORIES = [
  'meat',
  'vegetables',
  'rice_dry_goods',
  'packaging',
  'rent_services',
  'misc',
] as const;

export type Category = (typeof CATEGORIES)[number];
