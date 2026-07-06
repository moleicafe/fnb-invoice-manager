// Minimal Markdown renderer for AI-generated insight reports. Supports only
// what the insights prompt actually produces: ##/### headings, `-` bullet
// lists (grouped into <ul>), **bold** inline spans, and blank-line-separated
// paragraphs. No external dependencies.

function renderInline(text: string, key: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span key={key}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      )}
    </span>
  );
}

export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="my-2 list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b, i)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(<p key={blocks.length}>{renderInline(paragraph.join(' '), 0)}</p>);
    paragraph = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flushBullets();
      flushParagraph();
    } else if (line.startsWith('### ')) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h3 key={blocks.length} className="mt-4 font-semibold">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith('## ')) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h3 key={blocks.length} className="mt-4 font-semibold">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith('- ')) {
      flushParagraph();
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushBullets();
  flushParagraph();

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
