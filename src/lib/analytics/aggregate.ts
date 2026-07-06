export interface InvoiceRow {
  invoice_date: string | null;
  total: number | null;
  category: string;
  supplier_name: string;
  payment_status: string;
  review_status: string;
  payment_due_date: string | null;
}

export interface ItemRow {
  name_en: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number | null;
  invoice_date: string | null;
}

export interface MonthlyTotal {
  month: string;
  total: number;
}

export interface TotalBy {
  name: string;
  total: number;
}

export interface ItemStat {
  name: string;
  total: number;
  qty: number;
  avgUnitPrice: number | null;
  prevAvgUnitPrice: number | null;
  priceDeltaPct: number | null;
}

export interface Counters {
  pendingReview: number;
  unpaidTotal: number;
  dueSoonTotal: number;
}

/**
 * Extract YYYY-MM from ISO date string
 */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/**
 * Group invoice rows by month and sum totals.
 * Returns an entry for EVERY month in the input list (0 when no data).
 * Skips rows with null invoice_date.
 * Treats null total as 0 in sums.
 */
export function monthlyTotals(
  rows: InvoiceRow[],
  months: string[]
): MonthlyTotal[] {
  const totalsMap = new Map<string, number>();

  // Initialize all months with 0
  months.forEach((month) => {
    totalsMap.set(month, 0);
  });

  // Sum totals for each month (skip null invoice_date)
  rows.forEach((row) => {
    if (row.invoice_date === null) {
      return;
    }

    const month = monthKey(row.invoice_date);
    if (totalsMap.has(month)) {
      const current = totalsMap.get(month) || 0;
      const total = row.total ?? 0;
      totalsMap.set(month, current + total);
    }
  });

  // Return in order of input months
  return months.map((month) => ({
    month,
    total: totalsMap.get(month) || 0,
  }));
}

/**
 * Group invoice rows by key (category or supplier_name) and sum totals.
 * Sorted descending by total.
 */
export function totalsBy(
  rows: InvoiceRow[],
  key: "category" | "supplier_name"
): TotalBy[] {
  const totalsMap = new Map<string, number>();

  rows.forEach((row) => {
    const keyValue = row[key];
    const current = totalsMap.get(keyValue) || 0;
    const total = row.total ?? 0;
    totalsMap.set(keyValue, current + total);
  });

  return Array.from(totalsMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Group item rows by name_en (with fallback to description) and compute stats.
 * Sorted descending by total.
 *
 * Rules:
 * - avgUnitPrice = sumAmount / sumQty, but only when sumQty > 0 AND at least one row had non-null amount AND quantity
 * - priceDeltaPct = ((cur - prev) / prev) * 100, rounded to 1 decimal, null when either side null
 */
export function itemStats(
  current: ItemRow[],
  previous: ItemRow[]
): ItemStat[] {
  // Group current by name
  const currentMap = new Map<
    string,
    {
      total: number;
      qty: number;
      hasValidAvgPrice: boolean;
    }
  >();

  current.forEach((row) => {
    const name = row.name_en ?? row.description;
    const entry = currentMap.get(name) || {
      total: 0,
      qty: 0,
      hasValidAvgPrice: false,
    };

    const amount = row.amount ?? 0;
    entry.total += amount;

    if (row.quantity !== null) {
      entry.qty += row.quantity;
    }

    // Mark as valid only if at least one row has both amount and quantity
    if (row.amount !== null && row.quantity !== null) {
      entry.hasValidAvgPrice = true;
    }

    currentMap.set(name, entry);
  });

  // Group previous by name for price delta calculation
  const previousMap = new Map<
    string,
    {
      qty: number;
      amount: number;
      hasValidAvgPrice: boolean;
    }
  >();

  previous.forEach((row) => {
    const name = row.name_en ?? row.description;
    const entry = previousMap.get(name) || {
      qty: 0,
      amount: 0,
      hasValidAvgPrice: false,
    };

    const amount = row.amount ?? 0;
    entry.amount += amount;

    if (row.quantity !== null) {
      entry.qty += row.quantity;
    }

    if (row.amount !== null && row.quantity !== null) {
      entry.hasValidAvgPrice = true;
    }

    previousMap.set(name, entry);
  });

  // Build result array
  const result: ItemStat[] = Array.from(currentMap.entries()).map(
    ([name, curData]) => {
      // Compute current avgUnitPrice
      let curAvgUnitPrice: number | null = null;
      if (curData.qty > 0 && curData.hasValidAvgPrice) {
        curAvgUnitPrice = curData.total / curData.qty;
      }

      // Compute previous avgUnitPrice
      const prevData = previousMap.get(name);
      let prevAvgUnitPrice: number | null = null;
      if (prevData && prevData.qty > 0 && prevData.hasValidAvgPrice) {
        prevAvgUnitPrice = prevData.amount / prevData.qty;
      }

      // Compute priceDeltaPct
      let priceDeltaPct: number | null = null;
      if (
        curAvgUnitPrice !== null &&
        prevAvgUnitPrice !== null &&
        prevAvgUnitPrice !== 0
      ) {
        const delta = ((curAvgUnitPrice - prevAvgUnitPrice) / prevAvgUnitPrice) *
          100;
        priceDeltaPct = Math.round(delta * 10) / 10; // Round to 1 decimal
      }

      return {
        name,
        total: curData.total,
        qty: curData.qty,
        avgUnitPrice: curAvgUnitPrice,
        prevAvgUnitPrice,
        priceDeltaPct,
      };
    }
  );

  // Sort descending by total
  result.sort((a, b) => b.total - a.total);

  return result;
}

/**
 * Count pending review invoices, sum unpaid totals, and sum unpaid due within 14 days of todayIso (inclusive).
 * Treats null total as 0 in sums.
 */
export function counters(rows: InvoiceRow[], todayIso: string): Counters {
  let pendingReview = 0;
  let unpaidTotal = 0;
  let dueSoonTotal = 0;

  // Parse todayIso as a date for comparison
  const today = new Date(todayIso);

  rows.forEach((row) => {
    // Count pending review
    if (row.review_status === "pending") {
      pendingReview += 1;
    }

    // Sum unpaid totals
    if (row.payment_status === "unpaid") {
      const total = row.total ?? 0;
      unpaidTotal += total;

      // Sum unpaid due within 14 days
      if (row.payment_due_date !== null) {
        const dueDate = new Date(row.payment_due_date);
        const diffMs = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Within 14 days inclusive: 0 to 14 days
        if (diffDays >= 0 && diffDays <= 14) {
          dueSoonTotal += total;
        }
      }
    }
  });

  return { pendingReview, unpaidTotal, dueSoonTotal };
}
