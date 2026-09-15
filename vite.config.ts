import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Injects the Google Search Console verification meta tag at build time.
// The value comes from the environment (GitHub Actions variable or a local
// shell export), so it never needs to be committed to the repository.
// Without the variable the tag is simply omitted.
function googleSiteVerification(): Plugin {
  return {
    name: 'google-site-verification',
    transformIndexHtml(html) {
      const token = process.env.GOOGLE_SITE_VERIFICATION;
      if (!token) return html;
      return html.replace('</head>', `    <meta name="google-site-verification" content="${token}">\n  </head>`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), googleSiteVerification()],
});
