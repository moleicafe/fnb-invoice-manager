// Shared form-control styling (inputs and selects) — one string, one look.
export const fieldStyles =
  'h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground ' +
  'placeholder:text-muted-foreground/50 transition-all duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background';

// Compact variant for dense table rows (review-form line items).
export const fieldStylesCompact =
  'h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground/50 transition-all duration-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-accent';

export const labelStyles = 'flex flex-col gap-1.5 text-sm font-medium text-foreground';
