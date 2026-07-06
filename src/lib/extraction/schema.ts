import { z } from 'zod';
import { CATEGORIES } from '../categories';

export const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unit_price: z.number().nullable(),
  amount: z.number().nullable(),
  name_en: z.string().nullable(),
  name_zh: z.string().nullable(),
});

export const invoiceExtractionSchema = z.object({
  document_type: z.enum(['invoice', 'statement', 'other']),
  supplier_name: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  line_items: z.array(lineItemSchema),
  subtotal: z.number().nullable(),
  gst_amount: z.number().nullable(),
  total: z.number().nullable(),
  suggested_category: z.enum(CATEGORIES).nullable(),
});

export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;
