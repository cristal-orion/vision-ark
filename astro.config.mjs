// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Serve a canonical e og:url: senza, Base.astro ripiega sull'origin corrente.
  site: 'https://visionark.it',
});
