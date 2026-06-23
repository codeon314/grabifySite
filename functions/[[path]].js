// functions/[[path]].js
import serverHandler from '../dist/server/entry.mjs';

export const onRequest = (context) => {
  return serverHandler(context.request, context.env, context);
};