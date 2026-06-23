export async function onRequestPost() {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Overwrite the cookie with an immediate expiration date to delete it
      'Set-Cookie': `site_auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    }
  });
}