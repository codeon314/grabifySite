interface ApiResponse {
  success?: boolean;
  errors?: string[];
  [key: string]: any;
}

export async function grabifyRequest(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: URLSearchParams;
    cookie?: string;
  } = {}
): Promise<ApiResponse> {
  const { method = 'POST', body, cookie } = options;

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': method === 'GET'
      ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      : 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://grabify.org',
    'Referer': endpoint.includes('/track/') 
      ? `https://grabify.org/track/${endpoint.split('/track/')[1].split('/')[0]}/`
      : 'https://grabify.org/',
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const reqInit: RequestInit = {
    method,
    headers,
  };

  if (body && method === 'POST') {
    reqInit.body = body;
  }

  const response = await fetch(`https://grabify.org${endpoint}`, reqInit);
  
  // For GET requests we need to return the HTML text
  if (method === 'GET') {
    const html = await response.text();
    return { html, status: response.status };
  }

  const json = await response.json();
  if (!response.ok || json.errors) {
    throw new Error(json.errors ? json.errors.join('\n') : `HTTP ${response.status}`);
  }
  return json;
}