import { z } from 'zod';
import { CATEGORIES } from '../categories';
import { isValidIsoDate } from './checks';

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number().nullable(),
  amount: z.number().nullable(),
});

export const saveInvoiceSchema = z.object({
  locationId: z.string().uuid(),
  supplierId: z.string().uuid().nullable(),
  supplierName: z.string().min(1),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidIsoDate, 'invalid calendar date').nullable(),
  category: z.enum(CATEGORIES),
  subtotal: z.number().nullable(),
  gstAmount: z.number().nullable(),
  total: z.number().nullable(),
  filePaths: z.array(z.string()).min(1),
  extractionRaw: z.unknown().nullable(),
  confirmedDuplicate: z.boolean(),
  items: z.array(itemSchema),
});

export type SaveInvoiceBody = z.infer<typeof saveInvoiceSchema>;
