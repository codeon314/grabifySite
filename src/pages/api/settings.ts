import type { APIRoute } from 'astro';
import { grabifyRequest } from '../../lib/grabify-client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { code, smart, privacy, gps, forwarding, preview } = body;
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
    formData.append('smart', smart || '');
    formData.append('privacy', privacy || '');
    formData.append('gps', gps || '');
    formData.append('forwarding', forwarding || '');
    formData.append('preview', preview || '');
    formData.append('notify', '');
    formData.append('note', '');

    await grabifyRequest('/track/save/', {
      body: formData,
      cookie: `confirmation=${confirmation}`,
    });

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};