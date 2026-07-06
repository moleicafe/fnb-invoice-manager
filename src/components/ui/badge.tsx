// SectionLabel: the design system's signature mono pill with accent dot.
export function SectionLabel({ children, pulse = false }: { children: React.ReactNode; pulse?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5">
      <span className={`h-1.5 w-1.5 rounded-full bg-accent ${pulse ? 'animate-pulse-dot' : ''}`} />
      <span className="font-mono text-xs uppercase tracking-[0.15em] text-accent">{children}</span>
    </div>
  );
}

// StatusChip: semantic tints are a deliberate extension of the single-accent
// palette — payment/review state must be scannable in a data table, so the
// Electric Blue stays reserved for actions and approved state.
export type StatusKind = 'pending_review' | 'approved' | 'needs_manual_entry' | 'unpaid' | 'paid';

const chipStyles: Record<StatusKind, string> = {
  pending_review: 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-accent/20 bg-accent/5 text-accent',
  needs_manual_entry: 'border-red-200 bg-red-50 text-red-600',
  unpaid: 'border-border bg-muted text-muted-foreground',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-600',
};

export function StatusChip({ kind, label }: { kind: StatusKind; label: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${chipStyles[kind]}`}
    >
      {label}
    </span>
  );
}
