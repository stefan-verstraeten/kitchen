// Finishes the web export in dist/ for GitHub Pages:
// - adds the tags that let iPhone "Add to Home Screen" open it as an app;
// - copies index.html to 404.html so deep links (e.g. /kitchen/recipe/…,
//   and Dropbox's return to /kitchen/oauth) load the app instead of a 404;
// - adds .nojekyll so GitHub Pages serves the _expo folder.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const base = '/kitchen';
const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');

const tags = [
  `<link rel="manifest" href="${base}/manifest.webmanifest">`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="Kitchen">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
].join('\n    ');

if (!html.includes('rel="manifest"')) html = html.replace('</head>', `    ${tags}\n  </head>`);
// Let the app draw under the iPhone home indicator area; the tab bar adds the safe-area padding.
html = html.replace(/<meta name="viewport" content="([^"]*)"/, (m, content) =>
  content.includes('viewport-fit') ? m : `<meta name="viewport" content="${content}, viewport-fit=cover"`,
);

writeFileSync(indexPath, html);
writeFileSync(join(dist, '404.html'), html);
writeFileSync(join(dist, '.nojekyll'), '');
console.log('Prepared web build in', dist);
