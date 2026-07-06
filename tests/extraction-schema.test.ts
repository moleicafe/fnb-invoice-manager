import { describe, it, expect } from 'vitest';
import { invoiceExtractionSchema } from '../src/lib/extraction/schema';
import { toContentBlocks } from '../src/lib/extraction/extract';

const valid = {
  document_type: 'invoice',
  supplier_name: 'EBUY PTE. LTD.',
  invoice_number: '260704000669-1',
  invoice_date: '2026-07-04',
  line_items: [
    {
      description: '切有机菜花 (次品) Cut Organic Cauliflower (Defective)',
      quantity: 8.5,
      unit: 'kg',
      unit_price: 1.0,
      amount: 8.5,
      name_en: 'Organic Cauliflower (defective)',
      name_zh: '有机菜花（次品）',
    },
  ],
  subtotal: 8.5,
  gst_amount: 0.77,
  total: 9.27,
  suggested_category: 'vegetables',
};

describe('invoiceExtractionSchema', () => {
  it('accepts a complete invoice extraction', () => {
    expect(invoiceExtractionSchema.parse(valid)).toEqual(valid);
  });
  it('accepts nulls for fields a document may not print', () => {
    const sparse = { ...valid, invoice_number: null, subtotal: null, gst_amount: null, suggested_category: null };
    expect(invoiceExtractionSchema.parse(sparse).gst_amount).toBeNull();
  });
  it('rejects an unknown document_type', () => {
    expect(invoiceExtractionSchema.safeParse({ ...valid, document_type: 'receipt' }).success).toBe(false);
  });
  it('rejects a non-ISO date', () => {
    expect(invoiceExtractionSchema.safeParse({ ...valid, invoice_date: '04/07/2026' }).success).toBe(false);
  });
  it('accepts null standardized names', () => {
    const sparseNames = {
      ...valid,
      line_items: [{ ...valid.line_items[0], name_en: null, name_zh: null }],
    };
    expect(invoiceExtractionSchema.parse(sparseNames).line_items[0].name_en).toBeNull();
  });
  it('rejects a line item missing the name fields', () => {
    const { name_en: _en, name_zh: _zh, ...noNames } = valid.line_items[0];
    expect(invoiceExtractionSchema.safeParse({ ...valid, line_items: [noNames] }).success).toBe(false);
  });
});

describe('toContentBlocks', () => {
  it('maps PDFs to document blocks and images to image blocks', () => {
    const blocks = toContentBlocks([
      { data: Buffer.from('a'), mediaType: 'application/pdf' },
      { data: Buffer.from('b'), mediaType: 'image/jpeg' },
    ]);
    expect(blocks[0].type).toBe('document');
    expect(blocks[1].type).toBe('image');
  });
  it('throws on unsupported types', () => {
    expect(() => toContentBlocks([{ data: Buffer.from('x'), mediaType: 'text/plain' }])).toThrow();
  });
});
