import type { APIRoute } from 'astro';
import { grabifyRequest } from '../../lib/grabify-client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { code, id } = await request.json();
    if (!code || id == null) return new Response(JSON.stringify({ error: 'Code and id required' }), { status: 400 });

    let confirmation = cookies.get('grabify_confirmation')?.value;
    if (!confirmation) {
      confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
      cookies.set('grabify_confirmation', confirmation, {
        path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 31536000,
      });
    }

    const formData = new URLSearchParams();
    formData.append('code', code);
    formData.append('id', String(id));

    const result = await grabifyRequest('/track/smart/', {
      body: formData,
      cookie: `confirmation=${confirmation}`,
    });

    return new Response(JSON.stringify({ smart: result.smart }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};