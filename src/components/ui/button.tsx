// Zero-dependency button primitives following the app's plain-function style.
// buttonStyles() is exported separately so <Link> can wear the same clothes.

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium ' +
  'transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

const variants: Record<ButtonVariant, string> = {
  primary:
    'gradient-accent text-accent-foreground shadow-sm ' +
    'hover:-translate-y-0.5 hover:shadow-accent hover:brightness-110',
  outline:
    'border border-border bg-card text-foreground ' +
    'hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'text-red-600 hover:bg-red-50',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-sm sm:text-base',
};

export function buttonStyles(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button {...props} className={`${buttonStyles(variant, size)} ${className}`} />;
}
