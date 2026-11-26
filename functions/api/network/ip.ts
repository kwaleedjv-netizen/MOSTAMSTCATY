export const onRequestGet = async (context: { request: Request }): Promise<Response> => {
  const headers = context.request.headers;
  const cfIp = headers.get('cf-connecting-ip');
  const xff = headers.get('x-forwarded-for');

  let raw = cfIp?.trim() || (xff ? xff.split(',')[0].trim() : '') || 'unknown';
  if (raw.startsWith('::ffff:')) {
    raw = raw.slice(7);
  }
  if (raw === '::1') {
    raw = '127.0.0.1';
  }
  const ip = raw.slice(0, 64) || 'unknown';

  const data = new TextEncoder().encode(`mostamsakati_ip_v1:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const ipHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return new Response(
    JSON.stringify({
      ip,
      ipHash,
      detectedAt: new Date().toISOString(),
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
};
