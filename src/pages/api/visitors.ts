import type { APIRoute } from 'astro';
import { grabifyRequest } from '../../lib/grabify-client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { code, page = 1, showHideBots = '0' } = await request.json();
    if (!code) return new Response(JSON.stringify({ error: 'Code required' }), { status: 400 });

    let confirmation = cookies.get('grabify_confirmation')?.value;
    if (!confirmation) {
      confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
      cookies.set('grabify_confirmation', confirmation, {
        path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 31536000,
      });
    }

    const formData = new URLSearchParams();
    formData.append('code', code);
    formData.append('page', String(page));
    formData.append('sort', 'date');
    formData.append('order', 'desc');
    formData.append('showHideBots', showHideBots);

    const result = await grabifyRequest('/track/', {
      body: formData,
      cookie: `confirmation=${confirmation}`,
    });

    // Extract data-index from content HTML array
    const content = result.content || [];
    const indices = content.map((html: string) => {
      const match = html.match(/data-index="(\d+)"/);
      return match ? parseInt(match[1]) : null;
    }).filter((i: any) => i !== null);

    return new Response(JSON.stringify({
      clicks: result.clicks,
      unique: result.unique,
      next: result.next || 0,
      content: indices,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};