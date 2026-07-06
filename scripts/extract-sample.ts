import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractDocument } from '../src/lib/extraction/extract';

const MEDIA: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('usage: npm run extract:sample -- <file> [more files = pages of ONE document]');
    process.exit(1);
  }
  const files = await Promise.all(
    args.map(async (f) => {
      const mediaType = MEDIA[path.extname(f).toLowerCase()];
      if (!mediaType) throw new Error(`unsupported extension: ${f}`);
      return { data: await readFile(f), mediaType };
    }),
  );
  const started = Date.now();
  const result = await extractDocument(files);
  console.log(JSON.stringify(result, null, 2));
  console.error(`\nextracted in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
