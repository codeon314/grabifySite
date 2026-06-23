import type { APIRoute } from 'astro';
import { grabifyRequest } from '../../lib/grabify-client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { code, domain, path, extension } = await request.json();
    if (!code || !domain) return new Response(JSON.stringify({ error: 'Code and domain required' }), { status: 400 });

    let confirmation = cookies.get('grabify_confirmation')?.value;
    if (!confirmation) {
      confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
      cookies.set('grabify_confirmation', confirmation, {
        path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 31536000,
      });
    }

    const formData = new URLSearchParams();
    formData.append('code', code);
    formData.append('domain', domain);
    formData.append('path', path || '');
    formData.append('extension', extension || '');

    const result = await grabifyRequest('/track/custom/', {
      body: formData,
      cookie: `confirmation=${confirmation}`,
    });

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};