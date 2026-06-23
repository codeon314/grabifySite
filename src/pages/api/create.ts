import type { APIRoute } from 'astro';
import { grabifyRequest } from '../../lib/grabify-client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { url } = body;
    if (!url) return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 });

    // Get or create confirmation cookie
    let confirmation = cookies.get('grabify_confirmation')?.value;
    if (!confirmation) {
      confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
      cookies.set('grabify_confirmation', confirmation, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    const formData = new URLSearchParams();
    formData.append('url', url);
    formData.append('type', 'shorten');

    const result = await grabifyRequest('/', {
      body: formData,
      cookie: `confirmation=${confirmation}`,
    });

    // Extract tracking code from the go link
    const go = result.go as string;
    const codeMatch = go.match(/\/track\/([A-Za-z0-9]+)/);
    const code = codeMatch ? codeMatch[1] : null;

    return new Response(JSON.stringify({ go, code }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};