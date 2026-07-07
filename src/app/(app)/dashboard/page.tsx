import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { fetchDashboardData } from '@/lib/analytics/fetch';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { fieldStyles } from '@/components/ui/field';
import { MonthlyBar } from '@/components/charts/MonthlyBar';
import { CategoryBars } from '@/components/charts/CategoryBars';
import { SupplierBars } from '@/components/charts/SupplierBars';
import { InsightsPanel } from '@/components/InsightsPanel';

function money(v: number): string {
  return v.toFixed(2);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const t = await getTranslations();
  const { month: monthParam } = await searchParams;
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : defaultMonth;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user!.id)
    .single();
  if (profile?.role !== 'admin') notFound();

  const data = await fetchDashboardData(supabase, month);
  const { data: report } = await supabase
    .from('insight_reports')
    .select('content_md, created_at')
    .eq('period_month', `${month}-01`)
    .maybeSingle();

  const categories = data.categories.map((c) => ({ ...c, name: t(`categories.${c.name}`) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{t('dashboard.title')}</h1>
        <form method="GET" className="flex items-center gap-2">
          <input type="month" name="month" defaultValue={month} className={fieldStyles} />
          <button type="submit" className={buttonVariants()}>
            {t('invoices.apply')}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <p className="text-xs text-muted-foreground sm:text-sm">{t('dashboard.pendingReview')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:mt-2 sm:text-3xl">{data.counters.pendingReview}</p>
        </Card>
        <Card className="p-3 sm:p-6">
          <p className="text-xs text-muted-foreground sm:text-sm">{t('dashboard.unpaidTotal')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:mt-2 sm:text-3xl">{money(data.counters.unpaidTotal)}</p>
        </Card>
        <Card className="p-3 sm:p-6">
          <p className="text-xs text-muted-foreground sm:text-sm">{t('dashboard.dueSoon')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:mt-2 sm:text-3xl">{money(data.counters.dueSoonTotal)}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-[-0.01em]">{t('dashboard.monthlySpend')}</h2>
        {data.monthly.length > 0 ? (
          <MonthlyBar data={data.monthly} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold tracking-[-0.01em]">{t('dashboard.byCategory')}</h2>
          {categories.length > 0 ? (
            <CategoryBars data={categories} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold tracking-[-0.01em]">{t('dashboard.topSuppliers')}</h2>
          {data.suppliers.length > 0 ? (
            <SupplierBars data={data.suppliers} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-[-0.01em]">{t('dashboard.topItems')}</h2>
        {data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="p-1.5 font-medium">{t('dashboard.item')}</th>
                  <th className="p-1.5 font-medium">{t('dashboard.spend')}</th>
                  <th className="p-1.5 font-medium">{t('dashboard.avgUnitPrice')}</th>
                  <th className="p-1.5 font-medium">{t('dashboard.priceDelta')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.name} className="border-t border-border/60">
                    <td className="p-1.5">{item.name}</td>
                    <td className="p-1.5 tabular-nums">{money(item.total)}</td>
                    <td className="p-1.5 tabular-nums">
                      {item.avgUnitPrice == null ? '—' : money(item.avgUnitPrice)}
                    </td>
                    <td
                      className={
                        item.priceDeltaPct == null
                          ? 'p-1.5 tabular-nums text-muted-foreground'
                          : `p-1.5 tabular-nums ${item.priceDeltaPct > 0 ? 'text-red-600' : item.priceDeltaPct < 0 ? 'text-emerald-600' : ''}`
                      }
                    >
                      {item.priceDeltaPct == null
                        ? '—'
                        : `${item.priceDeltaPct > 0 ? '+' : ''}${item.priceDeltaPct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
        )}
      </Card>

      <InsightsPanel month={month} initialReport={report?.content_md ?? null} />
    </div>
  );
}
