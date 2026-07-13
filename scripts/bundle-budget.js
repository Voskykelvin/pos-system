'use strict';

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'dist', 'assets');
if (!fs.existsSync(assetsDir)) throw new Error('dist/assets is missing; run npm run build first');

const files = fs.readdirSync(assetsDir).map((name) => ({
  name,
  bytes: fs.statSync(path.join(assetsDir, name)).size
}));
const limits = [
  { pattern: /^index-.*\.js$/, max: 80 * 1024, label: 'application shell' },
  { pattern: /^Checkout-.*\.js$/, max: 90 * 1024, label: 'checkout route' },
  { pattern: /^vendor-react-.*\.js$/, max: 180 * 1024, label: 'React vendor chunk' },
  { pattern: /^vendor-recharts-.*\.js$/, max: 450 * 1024, label: 'analytics chart chunk' },
  { pattern: /^barcode-scanner-.*\.js$/, max: 550 * 1024, label: 'lazy camera barcode decoder' },
  { pattern: /^jijenge-pos-hero-.*\.jpg$/, max: 250 * 1024, label: 'marketing hero image' }
];

const failures = [];
for (const budget of limits) {
  const match = files.find((file) => budget.pattern.test(file.name));
  if (!match) failures.push(`${budget.label}: output chunk missing`);
  else if (match.bytes > budget.max) {
    failures.push(`${budget.label}: ${(match.bytes / 1024).toFixed(1)} KiB exceeds ${(budget.max / 1024).toFixed(0)} KiB`);
  }
}
if (failures.length) throw new Error(`Bundle budget failed:\n- ${failures.join('\n- ')}`);
console.log('Bundle budgets passed');
