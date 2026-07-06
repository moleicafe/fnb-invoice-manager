import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { invoiceExtractionSchema, type InvoiceExtraction } from './schema';

export interface DocumentFile {
  data: Buffer;
  mediaType: string;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const EXTRACTION_PROMPT = `You are reading a document a Singapore F&B business received from a supplier.
It may be a delivery invoice, tax invoice, thermal receipt, or a monthly statement (账单) that lists
many invoice numbers. Text may be English, Simplified Chinese, or mixed. Photos may be crumpled,
faint, or partially covered.

Classify document_type first:
- "invoice": a single invoice or receipt for one delivery/charge
- "statement": a monthly statement listing multiple invoice numbers with amounts
- "other": anything else

For an invoice, extract:
- supplier_name: the ISSUING company. The buyer is MING YUAN F&B PTE LTD (裕华园 / 千味山东大包 /
  西安面馆 outlets) — never return the buyer as the supplier.
- invoice_number and invoice_date (convert any printed format to YYYY-MM-DD).
- every line item, with description copied VERBATIM in its original language (do not translate).
- quantity, unit, unit_price, amount as plain numbers; null when not printed.
- subtotal, gst_amount (the GST/tax line), total — null when the document does not print the value.
  Never compute a missing value yourself.
- suggested_category: one of meat, vegetables, rice_dry_goods, packaging, rent_services, misc,
  judged from the goods (rent_services covers rent, management fees, utilities, cleaning).

For a statement or other document, fill supplier_name and total if visible; leave the rest
null and line_items empty.`;

export function toContentBlocks(files: DocumentFile[]) {
  return files.map((f) => {
    const data = f.data.toString('base64');
    if (f.mediaType === 'application/pdf') {
      return {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data },
      };
    }
    if (!IMAGE_TYPES.has(f.mediaType)) throw new Error(`unsupported file type: ${f.mediaType}`);
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: f.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data,
      },
    };
  });
}

export async function extractDocument(
  files: DocumentFile[],
  client: Anthropic = new Anthropic(),
): Promise<InvoiceExtraction> {
  const response = await client.messages.parse({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [...toContentBlocks(files), { type: 'text', text: EXTRACTION_PROMPT }],
      },
    ],
    output_config: { format: zodOutputFormat(invoiceExtractionSchema) },
  });
  if (response.stop_reason === 'refusal') throw new Error('extraction_refused');
  if (!response.parsed_output) throw new Error('extraction_unparseable');
  return response.parsed_output;
}
