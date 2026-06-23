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

  // 3. Check for the authentication cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const expectedPassword = env.SITE_PASSWORD || 'dev';
  const isAuth = cookieHeader.includes(`site_auth=${expectedPassword}`);

  if (!isAuth) {
    // If it's an API request, block it with a 401 Unauthorized
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // SECURE REWRITE: If it's a page request, serve the login page HTML instead.
    // This guarantees the real app HTML is NEVER sent to the browser unless authenticated.
    const loginUrl = new URL('/login', request.url);
    return env.ASSETS.fetch(loginUrl);
  }

  // 4. If authenticated, allow the request to proceed to the real app
  return next();
}