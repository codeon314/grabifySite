// functions/api/[[route]].js
const GRABIFY_BASE = 'https://grabify.org';

// Helper to forward requests to Grabify
async function grabifyRequest(path, method, body, cookie) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': method === 'GET'
      ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
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

// Parse a cookie string into an object
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(pair => {
      const [name, ...rest] = pair.split('=');
      if (name && rest.length) {
        cookies[name.trim()] = rest.join('=').trim();
      }
    });
  }
  return cookies;
}

export async function onRequestPost(context) {
  const { request } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace('/api/', '');

  // Read existing confirmation cookie from the request
  const cookieHeader = request.headers.get('Cookie');
  const cookies = parseCookies(cookieHeader);
  let confirmation = cookies['grabify_confirmation'];
  let newCookieSet = false;

  // If no cookie exists, generate a new one (this will be set on the response)
  if (!confirmation) {
    confirmation = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
    newCookieSet = true;
  }

  const body = await request.json();

  let responseBody;
  try {
    switch (route) {
      case 'create': {
        const { url: targetUrl } = body;
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: 'URL required' }), { status: 400 });
        }
        const formData = new URLSearchParams();
        formData.append('url', targetUrl);
        formData.append('type', 'shorten');
        const result = await grabifyRequest('/', 'POST', formData, `confirmation=${confirmation}`);
        const go = result.go;
        const codeMatch = go.match(/\/track\/([A-Za-z0-9]+)/);
        const code = codeMatch ? codeMatch[1] : null;
        responseBody = { go, code };
        break;
      }

      case 'load': {
        const { code } = body;
        if (!code) {
          return new Response(JSON.stringify({ error: 'Code required' }), { status: 400 });
        }
        const htmlRes = await grabifyRequest(`/track/${code}/`, 'GET', null, `confirmation=${confirmation}`);
        const html = htmlRes.text;

        // Use the exact patterns from the C# app (adapted to JS regex)
        const extract = (pattern) => {
          const match = html.match(pattern);
          return match ? match[1].trim() : '';
        };

        responseBody = {
          originalUrl:  extract(/<div class="destination"><span>([^<]*)<\/span>/i),
          shortLink:    extract(/<div class="shortlink">([^<]*)<\/div>/i),
          trackingCode: extract(/<div class="code">([^<]*)<\/div>/i),
          accessLink:   extract(/<div class="track">([^<]*)<\/div>/i),
          smart:        /<input[^>]*\bname="smart"[^>]*\bchecked/i.test(html),
          privacy:      /<input[^>]*\bname="privacy"[^>]*\bchecked/i.test(html),
          gps:          /<input[^>]*\bname="gps"[^>]*\bchecked/i.test(html),
          forwarding:   /<input[^>]*\bname="forwarding"[^>]*\bchecked/i.test(html),
          preview:      /<input[^>]*\bname="preview"[^>]*\bchecked/i.test(html),
        };
        break;
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
        responseBody = { success: true };
        break;
      }

      case 'custom': {
        const { code, domain, path, extension } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('domain', domain);
        formData.append('path', path || '');
        formData.append('extension', extension || '');
        const result = await grabifyRequest('/track/custom/', 'POST', formData, `confirmation=${confirmation}`);
        responseBody = result;
        break;
      }

      case 'destination': {
        const { code, destination } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('destination', destination);
        await grabifyRequest('/track/destination/', 'POST', formData, `confirmation=${confirmation}`);
        responseBody = { success: true };
        break;
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
        responseBody = {
          clicks: result.clicks,
          unique: result.unique,
          next: result.next || 0,
          content: indices,
        };
        break;
      }

      case 'smart': {
        const { code, id } = body;
        const formData = new URLSearchParams();
        formData.append('code', code);
        formData.append('id', String(id));
        const result = await grabifyRequest('/track/smart/', 'POST', formData, `confirmation=${confirmation}`);
        responseBody = { smart: result.smart };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }

  // Build response with JSON body
  const init = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  };

  // If we generated a new cookie, set it
  if (newCookieSet) {
    const cookieString = `grabify_confirmation=${confirmation}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
    init.headers['Set-Cookie'] = cookieString;
  }

  return new Response(JSON.stringify(responseBody), init);
}