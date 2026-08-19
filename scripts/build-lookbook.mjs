import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

/**
 * Shopify themes can only serve flat files out of /assets, so the React app is
 * bundled to a single self-executing file with no runtime imports.
 */
const options = {
  entryPoints: [path.join(root, 'src/jc-lookbook/index.jsx')],
  outfile: path.join(root, 'assets/jc-lookbook.js'),
  bundle: true,
  format: 'iife',
  target: ['es2018'],
  jsx: 'automatic',
  minify: !watch,
  sourcemap: false,
  // React is MIT licensed and we redistribute it inside this bundle, so its
  // copyright notices are collected at the end of the file rather than stripped.
  legalComments: 'eof',
  logLevel: 'info',
  banner: {
    js: [
      '/*!',
      ' * jc-lookbook — GENERATED FILE, DO NOT EDIT.',
      ' *',
      ' * Compiled from src/jc-lookbook/ by scripts/build-lookbook.mjs.',
      ' * Edit the source, then run `npm run build` to regenerate this file.',
      ' * It is committed because Shopify serves assets/ as flat files and has',
      ' * no build step of its own.',
      ' *',
      ' * ~92% of the bytes below are React and ReactDOM; the application code',
      ' * is the ~670 hand-written lines in src/jc-lookbook/. See explanations.md.',
      ' * Third-party licence notices are collected at the end of this file.',
      ' */',
    ].join('\n'),
  },
  define: {
    'process.env.NODE_ENV': watch ? '"development"' : '"production"',
  },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[jc-lookbook] watching src/jc-lookbook…');
} else {
  await build(options);
}
