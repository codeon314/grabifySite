import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://grabify.mastercodeon.dev',
  output: 'server',
  adapter: cloudflare()
});