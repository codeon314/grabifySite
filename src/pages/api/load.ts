import type { APIRoute } from 'astro';
import { grabifyRequest } from '../../lib/grabify-client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { code } = await request.json();
    if (!code) return new Response(JSON.stringify({ error: 'Code required' }), { status: 400 });

    let confirmation = cookies.get('grabify_confirmation')?.value;
    if (!confirmation) {
      confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
      cookies.set('grabify_confirmation', confirmation, {
        path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 31536000,
      });
    }

    const pageUrl = `/track/${code}/`;
    const res = await grabifyRequest(pageUrl, {
      method: 'GET',
      cookie: `confirmation=${confirmation}`,
    });

    const html = (res as any).html as string;

    // Simple regex extraction (similar to C#)
    const extract = (pattern: string) => {
      const match = html.match(new RegExp(pattern));
      return match ? match[1].trim() : '';
    };

    const originalUrl = extract('<div class="destination"><span>([^<]*)</span>');
    const trackingCode = extract('<div class="code">([^<]*)</div>');
    const accessLink = extract('<div class="track">([^<]*)</div>');
    const shortLink = extract('<div class="shortlink">([^<]*)</div>');

    // Checkbox states
    const smart = /<input[^>]*name="smart"[^>]*checked/.test(html);
    const privacy = /<input[^>]*name="privacy"[^>]*checked/.test(html);
    const gps = /<input[^>]*name="gps"[^>]*checked/.test(html);
    const forwarding = /<input[^>]*name="forwarding"[^>]*checked/.test(html);
    const preview = /<input[^>]*name="preview"[^>]*checked/.test(html);

    return new Response(JSON.stringify({
      originalUrl,
      shortLink,
      trackingCode,
      accessLink,
      smart,
      privacy,
      gps,
      forwarding,
      preview,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};