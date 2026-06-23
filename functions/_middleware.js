// Helper function to generate a context-bound session hash
async function generateSessionToken(ip, userAgent, secret) {
  const encoder = new TextEncoder();
  // Bind the session to the specific IP and Browser
  const data = encoder.encode(`${ip}|${userAgent}|${secret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. Allow static assets to load (CSS, JS, images, favicon)
  if (path.match(/\.(css|js|svg|png|jpg|jpeg|ico|gif)$/) || path.startsWith('/_astro/')) {
    return next();
  }

  // 2. Allow the login page and login API to pass through
  if (path === '/login' || path === '/login/' || path.startsWith('/api/login')) {
    return next();
  }

  // 3. Fail-Closed Security: Ensure the password environment variable exists
  const SITE_PASSWORD = env.SITE_PASSWORD;
  if (!SITE_PASSWORD) {
    return new Response("Security Error: SITE_PASSWORD environment variable is not configured in Cloudflare.", { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // 4. Extract and validate the context-bound cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/site_auth=([^;]+)/);
  const clientToken = match ? match[1] : null;

  let isAuth = false;
  if (clientToken) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ua = request.headers.get('User-Agent') || 'unknown';
    
    // Recompute the hash based on the current request's context
    const expectedToken = await generateSessionToken(ip, ua, SITE_PASSWORD);
    
    // If the cookie matches the expected context hash, they are authenticated
    if (clientToken === expectedToken) {
      isAuth = true;
    }
  }

  if (!isAuth) {
    // If it's an API request, block it with a 401 Unauthorized
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized or Session Invalidated' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // SECURE REWRITE: If it's a page request, serve the login page HTML instead.
    const loginUrl = new URL('/login', request.url);
    return env.ASSETS.fetch(loginUrl);
  }

  // 5. If authenticated, allow the request to proceed to the real app
  return next();
}