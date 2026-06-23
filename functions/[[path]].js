// functions/[[path]].js
import serverHandler from '../dist/server/entry.mjs';

export const onRequest = async (context) => {
  try {
    // The Astro server handler expects (request, env, context)
    return await serverHandler(context.request, context.env, context);
  } catch (error) {
    console.error('Function error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};