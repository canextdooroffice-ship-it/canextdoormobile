import fs from 'fs';
import path from 'path';

const swPath = path.resolve('public/sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Generate a unique version string based on current timestamp
const version = new Date().toISOString().replace(/[:.-]/g, '');

// Replace the CACHE_NAME declaration
swContent = swContent.replace(
  /const CACHE_NAME = 'ca-next-door-v[^']*';/,
  `const CACHE_NAME = 'ca-next-door-v${version}';`
);

fs.writeFileSync(swPath, swContent, 'utf8');
console.log(`Updated Service Worker cache name to: ca-next-door-v${version}`);
