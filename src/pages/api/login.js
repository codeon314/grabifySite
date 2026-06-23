export const POST = async ({ request, locals }) => {
  console.log("[API/LOGIN] Received POST request");
  try {
    const body = await request.json();
    console.log("[API/LOGIN] Parsed body successfully");

    const runtimeEnv = locals.runtime?.env || (typeof process !== 'undefined' ? process.env : {});
    const SITE_PASSWORD = runtimeEnv.SITE_PASSWORD || (import.meta.env ? import.meta.env.SITE_PASSWORD : null) || 'dev';

    if (body.password === SITE_PASSWORD) {
      console.log("[API/LOGIN] Password matched");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `site_auth=${body.password}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
        }
      });
    } else {
      console.log("[API/LOGIN] Password mismatch");
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (e) {
    console.error("[API/LOGIN] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const ALL = async ({ request }) => {
  console.log(`[API/LOGIN] Received ${request.method} request (Expected POST)`);
  return new Response(JSON.stringify({ error: `Method ${request.method} not allowed. Use POST.` }), { 
    status: 405,
    headers: { 'Content-Type': 'application/json' }
  });
};