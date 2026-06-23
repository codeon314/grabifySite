import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare() // Removing mode: 'directory' forces Astro to generate a _worker.js file
});