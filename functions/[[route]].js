const GRABIFY_BASE = 'https://grabify.org';

// Simple helper to forward the request
async function grabifyRequest(path, method, body, cookie) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': method === 'GET'
      ? 'text/html,application/xhtml+xml'
      : 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': GRABIFY_BASE,
    'Referer': path.includes('/track/')
      ? `${GRABIFY_BASE}/track/${path.split('/track/')[1].split('/')[0]}/`
      : `${GRABIFY_BASE}/`,
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const init = { method, headers };
  if (method === 'POST' && body) {
    init.body = body;
  }

  const res = await fetch(`${GRABIFY_BASE}${path}`, init);

  if (method === 'GET') {
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors ? json.errors.join('\n') : `HTTP ${res.status}`);
  }
  return json;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace('/api/', '');

  // Manage the Grabify confirmation cookie using a Cloudflare KV namespace
  // (If you don't have KV, we can fallback to a hardcoded dummy value)
  const kv = env.GRABIFY_KV; // optional, we'll handle fallback
  let confirmation;

  if (kv) {
    confirmation = await kv.get('grabify_confirmation');
    if (!confirmation) {
      confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
      await kv.put('grabify_confirmation', confirmation, { expirationTtl: 86400 * 365 });
    }
  } else {
    // Fallback: generate a new one each time (less ideal but works)
    confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  const body = await request.json();

  try {
    switch (route) {
      case 'create': {
        const { url: targetUrl } = body;
        if (!targetUrl) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400 });
        const formData = new URLSearchParams();
        formData.append('url', targetUrl);
        formData.append('type', 'shorten');
        const result = await grabifyRequest('/', 'POST', formData, `confirmation=${confirmation}`);
        const go = result.go;
        const codeMatch = go.match(/\/track\/([A-Za-z0-9]+)/);
        const code = codeMatch ? codeMatch[1] : null;
        return new Response(JSON.stringify({ go, code }), { status: 200 });
      }

      case 'load': {
        const { code } = body;
        if (!code) return new Response(JSON.stringify({ error: 'Code required' }), { status: 400 });
        const htmlRes = await grabifyRequest(`/track/${code}/`, 'GET', null, `confirmation=${confirmation}`);
        const html = htmlRes.text;

        // Helper: extract first capture group from regex, with fallback
        const extract = (pattern) => {
          const match = html.match(new RegExp(pattern, 'i'));
          return match ? match[1].trim() : '';
        };

        // More tolerant regex (allow extra attributes inside tags)
        return new Response(JSON.stringify({
          originalUrl: extract('<div[^>]*class="destination"[^>]*>\\s*<span[^>]*>([^<]*)'),
          shortLink:   extract('<div[^>]*class="shortlink"[^>]*>([^<]*)'),
          trackingCode:extract('<div[^>]*class="code"[^>]*>([^<]*)'),
          accessLink:  extract('<div[^>]*class="track"[^>]*>([^<]*)'),
          smart:       /<input[^>]*name="smart"[^>]*checked/i.test(html),
          privacy:     /<input[^>]*name="privacy"[^>]*checked/i.test(html),
          gps:         /<input[^>]*name="gps"[^>]*checked/i.test(html),
          forwarding:  /<input[^>]*name="forwarding"[^>]*checked/i.test(html),
          preview:     /<input[^>]*name="preview"[^>]*checked/i.test(html),
        }), { status: 200 });
      }

      case 'settings': {
        const { code, smart, privacy, gps, forwarding, preview } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('smart', smart || '');
        formData.append('privacy', privacy || '');
        formData.append('gps', gps || '');
        formData.append('forwarding', forwarding || '');
        formData.append('preview', preview || '');
        formData.append('notify', '');
        formData.append('note', '');
        await grabifyRequest('/track/save/', 'POST', formData, `confirmation=${confirmation}`);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      case 'custom': {
        const { code, domain, path, extension } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('domain', domain);
        formData.append('path', path || '');
        formData.append('extension', extension || '');
        const result = await grabifyRequest('/track/custom/', 'POST', formData, `confirmation=${confirmation}`);
        return new Response(JSON.stringify(result), { status: 200 });
      }

      case 'destination': {
        const { code, destination } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('destination', destination);
        await grabifyRequest('/track/destination/', 'POST', formData, `confirmation=${confirmation}`);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      case 'visitors': {
        const { code, page = 1, showHideBots = '0' } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('page', String(page));
        formData.append('sort', 'date');
        formData.append('order', 'desc');
        formData.append('showHideBots', showHideBots);
        const result = await grabifyRequest('/track/', 'POST', formData, `confirmation=${confirmation}`);
        const indices = (result.content || []).map(html => {
          const match = html.match(/data-index="(\d+)"/);
          return match ? parseInt(match[1]) : null;
        }).filter(Boolean);
        return new Response(JSON.stringify({
          clicks: result.clicks,
          unique: result.unique,
          next: result.next || 0,
          content: indices,
        }), { status: 200 });
      }

      case 'smart': {
        const { code, id } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('id', String(id));
        const result = await grabifyRequest('/track/smart/', 'POST', formData, `confirmation=${confirmation}`);
        return new Response(JSON.stringify({ smart: result.smart }), { status: 200 });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}