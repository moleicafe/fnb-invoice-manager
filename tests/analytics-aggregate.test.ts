import { describe, it, expect } from "vitest";
import {
  InvoiceRow,
  ItemRow,
  monthKey,
  monthlyTotals,
  totalsBy,
  itemStats,
  counters,
} from "../src/lib/analytics/aggregate";

describe("monthKey", () => {
  it("extracts YYYY-MM from ISO date string", () => {
    expect(monthKey("2026-07-04")).toBe("2026-07");
    expect(monthKey("2026-01-15")).toBe("2026-01");
    expect(monthKey("2025-12-31")).toBe("2025-12");
  });
});

describe("monthlyTotals", () => {
  it("returns zero for months with no data", () => {
    const rows: InvoiceRow[] = [];
    const months = ["2026-06", "2026-07", "2026-08"];
    const result = monthlyTotals(rows, months);

    expect(result).toEqual([
      { month: "2026-06", total: 0 },
      { month: "2026-07", total: 0 },
      { month: "2026-08", total: 0 },
    ]);
  });

  it("sums totals correctly and includes all requested months", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-15",
        total: 50,
        category: "office",
        supplier_name: "Supplier B",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-08-01",
        total: 200,
        category: "supplies",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
    ];
    const months = ["2026-07", "2026-08"];
    const result = monthlyTotals(rows, months);

    expect(result).toEqual([
      { month: "2026-07", total: 150 },
      { month: "2026-08", total: 200 },
    ]);
  });

  it("skips rows with null invoice_date", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: null,
        total: 50,
        category: "office",
        supplier_name: "Supplier B",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: null,
      },
    ];
    const months = ["2026-07"];
    const result = monthlyTotals(rows, months);

    expect(result).toEqual([{ month: "2026-07", total: 100 }]);
  });

  it("treats null total as 0 in sums", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-15",
        total: null,
        category: "office",
        supplier_name: "Supplier B",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: null,
      },
    ];
    const months = ["2026-07"];
    const result = monthlyTotals(rows, months);

    expect(result).toEqual([{ month: "2026-07", total: 100 }]);
  });
});

describe("totalsBy", () => {
  it("groups by category and sorts descending by total", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-02",
        total: 50,
        category: "supplies",
        supplier_name: "Supplier B",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-03",
        total: 75,
        category: "office",
        supplier_name: "Supplier C",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
    ];

    const result = totalsBy(rows, "category");
    expect(result).toEqual([
      { name: "office", total: 175 },
      { name: "supplies", total: 50 },
    ]);
  });

  it("groups by supplier_name and sorts descending by total", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-02",
        total: 250,
        category: "supplies",
        supplier_name: "Supplier B",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-03",
        total: 50,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: null,
      },
    ];

    const result = totalsBy(rows, "supplier_name");
    expect(result).toEqual([
      { name: "Supplier B", total: 250 },
      { name: "Supplier A", total: 150 },
    ]);
  });
});

describe("itemStats", () => {
  it("groups by name_en with fallback to description", () => {
    const current: ItemRow[] = [
      {
        name_en: "Widget A",
        description: "A basic widget",
        quantity: 2,
        unit: "pcs",
        unit_price: 50,
        amount: 100,
        invoice_date: "2026-07-01",
      },
      {
        name_en: "Widget A",
        description: "A basic widget",
        quantity: 3,
        unit: "pcs",
        unit_price: 50,
        amount: 150,
        invoice_date: "2026-07-02",
      },
      {
        name_en: null,
        description: "Gadget B",
        quantity: 1,
        unit: "pcs",
        unit_price: 100,
        amount: 100,
        invoice_date: "2026-07-03",
      },
    ];
    const previous: ItemRow[] = [];

    const result = itemStats(current, previous);

    expect(result.length).toBe(2);
    expect(result[0]).toMatchObject({
      name: "Widget A",
      total: 250,
      qty: 5,
      avgUnitPrice: 50,
    });
    expect(result[1]).toMatchObject({
      name: "Gadget B",
      total: 100,
      qty: 1,
      avgUnitPrice: 100,
    });
  });

  it("computes avgUnitPrice = sum(amount) / sum(qty) when both present", () => {
    const current: ItemRow[] = [
      {
        name_en: "Item X",
        description: "Item X desc",
        quantity: 10,
        unit: "kg",
        unit_price: null,
        amount: 250,
        invoice_date: "2026-07-01",
      },
      {
        name_en: "Item X",
        description: "Item X desc",
        quantity: 5,
        unit: "kg",
        unit_price: null,
        amount: 150,
        invoice_date: "2026-07-02",
      },
    ];
    const previous: ItemRow[] = [];

    const result = itemStats(current, previous);

    expect(result[0].avgUnitPrice).toBe(26.666666666666668); // (250 + 150) / (10 + 5) = 400 / 15
  });

  it("returns null avgUnitPrice when sumQty is 0", () => {
    const current: ItemRow[] = [
      {
        name_en: "Item Y",
        description: "Item Y desc",
        quantity: 0,
        unit: "kg",
        unit_price: 50,
        amount: null,
        invoice_date: "2026-07-01",
      },
    ];
    const previous: ItemRow[] = [];

    const result = itemStats(current, previous);

    expect(result[0].avgUnitPrice).toBeNull();
  });

  it("returns null avgUnitPrice when no rows have both amount and quantity", () => {
    const current: ItemRow[] = [
      {
        name_en: "Item Z",
        description: "Item Z desc",
        quantity: null,
        unit: "kg",
        unit_price: 50,
        amount: 100,
        invoice_date: "2026-07-01",
      },
      {
        name_en: "Item Z",
        description: "Item Z desc",
        quantity: 5,
        unit: "kg",
        unit_price: 50,
        amount: null,
        invoice_date: "2026-07-02",
      },
    ];
    const previous: ItemRow[] = [];

    const result = itemStats(current, previous);

    expect(result[0].avgUnitPrice).toBeNull();
  });

  it("computes priceDeltaPct = ((cur - prev) / prev) * 100 rounded to 1 decimal", () => {
    const current: ItemRow[] = [
      {
        name_en: "Item A",
        description: "Item A desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 55,
        amount: 55,
        invoice_date: "2026-07-01",
      },
    ];
    const previous: ItemRow[] = [
      {
        name_en: "Item A",
        description: "Item A desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 50,
        amount: 50,
        invoice_date: "2026-06-01",
      },
    ];

    const result = itemStats(current, previous);

    // (55 - 50) / 50 * 100 = 10.0
    expect(result[0].priceDeltaPct).toBe(10.0);
  });

  it("computes priceDeltaPct = -10.0 when price decreases by 10%", () => {
    const current: ItemRow[] = [
      {
        name_en: "Item B",
        description: "Item B desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 45,
        amount: 45,
        invoice_date: "2026-07-01",
      },
    ];
    const previous: ItemRow[] = [
      {
        name_en: "Item B",
        description: "Item B desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 50,
        amount: 50,
        invoice_date: "2026-06-01",
      },
    ];

    const result = itemStats(current, previous);

    // (45 - 50) / 50 * 100 = -10.0
    expect(result[0].priceDeltaPct).toBe(-10.0);
  });

  it("returns null priceDeltaPct when previous data is missing", () => {
    const current: ItemRow[] = [
      {
        name_en: "Item C",
        description: "Item C desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 55,
        amount: 55,
        invoice_date: "2026-07-01",
      },
    ];
    const previous: ItemRow[] = [];

    const result = itemStats(current, previous);

    expect(result[0].priceDeltaPct).toBeNull();
  });

  it("returns null priceDeltaPct when current data is missing", () => {
    const current: ItemRow[] = [];
    const previous: ItemRow[] = [
      {
        name_en: "Item D",
        description: "Item D desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 50,
        amount: 50,
        invoice_date: "2026-06-01",
      },
    ];

    const result = itemStats(current, previous);

    expect(result.length).toBe(0);
  });

  it("sorts results descending by total", () => {
    const current: ItemRow[] = [
      {
        name_en: "Low Total",
        description: "Low Total desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 10,
        amount: 10,
        invoice_date: "2026-07-01",
      },
      {
        name_en: "High Total",
        description: "High Total desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 100,
        amount: 100,
        invoice_date: "2026-07-01",
      },
      {
        name_en: "Mid Total",
        description: "Mid Total desc",
        quantity: 1,
        unit: "pcs",
        unit_price: 50,
        amount: 50,
        invoice_date: "2026-07-01",
      },
    ];
    const previous: ItemRow[] = [];

    const result = itemStats(current, previous);

    expect(result[0].name).toBe("High Total");
    expect(result[1].name).toBe("Mid Total");
    expect(result[2].name).toBe("Low Total");
  });
});

describe("counters", () => {
  it("counts pending review invoices", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "pending",
        payment_due_date: "2026-07-20",
      },
      {
        invoice_date: "2026-07-02",
        total: 50,
        category: "office",
        supplier_name: "Supplier B",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-03",
        total: 75,
        category: "supplies",
        supplier_name: "Supplier C",
        payment_status: "unpaid",
        review_status: "pending",
        payment_due_date: "2026-07-25",
      },
    ];
    const todayIso = "2026-07-06";

    const result = counters(rows, todayIso);

    expect(result.pendingReview).toBe(2);
  });

  it("sums unpaid totals", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "pending",
        payment_due_date: "2026-07-20",
      },
      {
        invoice_date: "2026-07-02",
        total: 50,
        category: "office",
        supplier_name: "Supplier B",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: null,
      },
      {
        invoice_date: "2026-07-03",
        total: 75,
        category: "supplies",
        supplier_name: "Supplier C",
        payment_status: "unpaid",
        review_status: "pending",
        payment_due_date: "2026-07-25",
      },
    ];
    const todayIso = "2026-07-06";

    const result = counters(rows, todayIso);

    expect(result.unpaidTotal).toBe(175);
  });

  it("counts unpaid invoices due within 14 days of todayIso (inclusive)", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "pending",
        payment_due_date: "2026-07-20", // within 14 days (day 14)
      },
      {
        invoice_date: "2026-07-02",
        total: 50,
        category: "office",
        supplier_name: "Supplier B",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: "2026-07-21", // outside 14 days (day 15)
      },
      {
        invoice_date: "2026-07-03",
        total: 75,
        category: "supplies",
        supplier_name: "Supplier C",
        payment_status: "unpaid",
        review_status: "pending",
        payment_due_date: "2026-07-06", // today (day 0)
      },
      {
        invoice_date: "2026-07-04",
        total: 25,
        category: "office",
        supplier_name: "Supplier D",
        payment_status: "paid",
        review_status: "approved",
        payment_due_date: "2026-07-20", // paid, so not counted
      },
    ];
    const todayIso = "2026-07-06";

    const result = counters(rows, todayIso);

    // 100 (day 14) + 75 (day 0) = 175
    expect(result.dueSoonTotal).toBe(175);
  });

  it("treats null total as 0 in unpaid and dueSoon sums", () => {
    const rows: InvoiceRow[] = [
      {
        invoice_date: "2026-07-01",
        total: 100,
        category: "office",
        supplier_name: "Supplier A",
        payment_status: "unpaid",
        review_status: "pending",
        payment_due_date: "2026-07-20",
      },
      {
        invoice_date: "2026-07-02",
        total: null,
        category: "office",
        supplier_name: "Supplier B",
        payment_status: "unpaid",
        review_status: "approved",
        payment_due_date: "2026-07-10",
      },
    ];
    const todayIso = "2026-07-06";

    const result = counters(rows, todayIso);

    expect(result.unpaidTotal).toBe(100);
    expect(result.dueSoonTotal).toBe(100);
  });
});
