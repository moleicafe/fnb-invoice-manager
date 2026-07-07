'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ITEMS = [
  {
    href: '/upload',
    key: 'upload',
    icon: <path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  },
  {
    href: '/invoices',
    key: 'invoices',
    icon: <path d="M6 3h9l4 4v14H6zM9 9h7M9 13h7M9 17h5" />,
  },
  {
    href: '/dashboard',
    key: 'dashboard',
    icon: <path d="M4 20v-6m6 6V4m6 16v-9" />,
  },
] as const;

// Bottom tab bar for phones — the header nav is hidden below the sm breakpoint.
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <div className="mx-auto flex max-w-md">
        {ITEMS.filter((item) => item.key !== 'dashboard' || isAdmin).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 whitespace-nowrap py-2.5 text-[11px] font-medium transition-colors duration-200 ${
                active ? 'text-accent' : 'text-muted-foreground'
              }`}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
