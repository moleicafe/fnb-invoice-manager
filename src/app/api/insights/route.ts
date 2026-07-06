import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { fetchDashboardData } from '@/lib/analytics/fetch';
import { buildInsightsPrompt } from '@/lib/insights/prompt';

export const maxDuration = 60;

const MODEL = 'claude-opus-4-8';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json()) as { month?: unknown };
  if (typeof body.month !== 'string' || !/^\d{4}-\d{2}$/.test(body.month)) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }

  const data = await fetchDashboardData(supabase, body.month);

  let content: string;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: buildInsightsPrompt(data) }],
    });
    if (response.stop_reason === 'refusal') throw new Error('refusal');
    content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .trim();
    if (!content) throw new Error('empty');
  } catch (e) {
    console.error('insights generation failed', e);
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
  }

  const { error } = await supabase.from('insight_reports').upsert(
    { period_month: `${body.month}-01`, content_md: content, model: MODEL },
    { onConflict: 'period_month' },
  );
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });

  return NextResponse.json({ content });
}
