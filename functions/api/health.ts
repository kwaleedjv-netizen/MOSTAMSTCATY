export const onRequestGet = async (): Promise<Response> => {
  return new Response(
    JSON.stringify({
      status: 'online',
      serverName: 'MOSTAMSAKATI Cloudflare Pages Gateway',
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
};
