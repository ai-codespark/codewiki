import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  context: { params: { provider: string } }
) {
  const { provider } = context.params || { provider: '' };

  if (provider !== 'litellm') {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const baseUrl = process.env.LITELLM_BASE_URL || '';
  const apiKey = process.env.LITELLM_API_KEY || '';

  if (!baseUrl) {
    return NextResponse.json({ error: 'Missing LITELLM_BASE_URL' }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing LITELLM_API_KEY' }, { status: 400 });
  }

  const url = `${baseUrl.replace(/\/$/, '')}/models`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    const text = await res.text();

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON from LiteLLM /models' }, { status: 502 });
    }

    type LiteLLMModel = { id?: string; model?: string };

    let data: LiteLLMModel[] = [];
    if (Array.isArray(json)) {
      data = json as LiteLLMModel[];
    } else if (json && typeof json === 'object') {
      const j = json as { data?: unknown };
      if (Array.isArray(j.data)) {
        data = j.data as LiteLLMModel[];
      }
    }

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Unexpected response shape from LiteLLM /models' }, { status: 502 });
    }

    const models = data
      .map((m) => {
        const id = typeof m.id === 'string' ? m.id : typeof m.model === 'string' ? m.model : '';
        if (!id) return null;
        return { id, name: id };
      })
      .filter((m): m is { id: string; name: string } => !!m);

    if (!res.ok && models.length === 0) {
      return NextResponse.json({ error: `LiteLLM /models error: ${res.status}` }, { status: res.status || 502 });
    }

    return NextResponse.json(models);
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message || 'Failed to fetch models from LiteLLM' }, { status: 500 });
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}