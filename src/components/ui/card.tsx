export function Card({
  className = '',
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      {...props}
      className={
        'rounded-2xl border border-border bg-card shadow-md ' +
        (hover ? 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ' : '') +
        className
      }
    />
  );
}
