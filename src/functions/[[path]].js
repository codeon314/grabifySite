// functions/[[path]].js
import { handleRequest } from '../dist/server/entry.mjs';

export async function onRequest(context) {
  return handleRequest(context);
}