// Helper function to generate a context-bound session hash
async function generateSessionToken(ip, userAgent, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${ip}|${userAgent}|${secret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const SITE_PASSWORD = env.SITE_PASSWORD;

    // Fail-Closed Security Check
    if (!SITE_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: SITE_PASSWORD not set' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (body.password === SITE_PASSWORD) {
      // Grab the user's specific context
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const ua = request.headers.get('User-Agent') || 'unknown';
      
      // Generate the context-bound token
      const token = await generateSessionToken(ip, ua, SITE_PASSWORD);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Store the hash in the cookie, NOT the plaintext password
          'Set-Cookie': `site_auth=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
        }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
}