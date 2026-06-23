// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
    imageService: 'passthrough',   // no image binding required
    // session: { enabled: false }  // optional, but omitting it works
  })
});