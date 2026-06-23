// In-memory fallback for local development if Cloudflare KV is not yet bound
const localDevCache = new Map();

// Rate Limiting Configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 60 seconds
const MAX_ATTEMPTS_PER_WINDOW = 5;

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
    // 1. Extract Identifiers for Rate Limiting
    const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
    const fingerprint = request.headers.get('X-Client-Fingerprint');

    // Reject requests that stripped the fingerprint header
    if (!fingerprint || fingerprint.length < 32) {
      return new Response(JSON.stringify({ error: 'Invalid client signature. Request rejected.' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Dual-Layer Rate Limiting Check
    const ipKey = `login_rl_ip_${ip}`;
    const fpKey = `login_rl_fp_${fingerprint}`;
    const now = Date.now();

    async function checkAndEnforceLimit(key) {
      let timestamps = [];
      if (env && env.RATE_LIMIT_KV) {
        const rlStr = await env.RATE_LIMIT_KV.get(key);
        if (rlStr) timestamps = JSON.parse(rlStr);
      } else {
        const rlStr = localDevCache.get(key);
        if (rlStr) timestamps = JSON.parse(rlStr);
      }

      // Filter out timestamps older than the 60-second window
      timestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

      if (timestamps.length >= MAX_ATTEMPTS_PER_WINDOW) {
        return false; // Rate limit exceeded
      }

      timestamps.push(now);

      // Save back to KV with a 120-second expiration to auto-cleanup
      if (env && env.RATE_LIMIT_KV) {
        await env.RATE_LIMIT_KV.put(key, JSON.stringify(timestamps), { expirationTtl: 120 });
      } else {
        localDevCache.set(key, JSON.stringify(timestamps));
      }
      return true; // Allowed
    }

    // Check both IP and Fingerprint independently
    const ipAllowed = await checkAndEnforceLimit(ipKey);
    const fpAllowed = await checkAndEnforceLimit(fpKey);

    if (!ipAllowed || !fpAllowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait 60 seconds before trying again.' }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Process Login
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
    return new Response(JSON.stringify({ error: 'Bad request' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}