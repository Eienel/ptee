/**
 * Guards the failure that took the first deploy down: a build-time endpoint
 * that is set but blank reached `new Connection('')`, which throws during
 * render and leaves a blank page. `??` does not catch an empty string.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';

execFileSync('npx', ['esbuild', 'src/lib/rpc.ts', '--bundle', '--format=esm', '--platform=node',
  '--outfile=.rpc.test.mjs', '--log-level=warning'], { stdio: 'inherit' });
const { normalizeEndpoint, initialEndpoint, PUBLIC_RPC } = await import('../.rpc.test.mjs');

// Rejected: anything that is not a usable http(s) URL.
for (const bad of ['', '   ', undefined, null, 42, {}, 'not a url', 'ftp://example.com', 'ws://example.com']) {
  assert.equal(normalizeEndpoint(bad), null, `should reject ${JSON.stringify(bad)}`);
}

// Accepted, and trimmed input is preserved as given.
assert.equal(normalizeEndpoint('https://example.com/v2/key'), 'https://example.com/v2/key');
assert.equal(normalizeEndpoint('  https://example.com  '), 'https://example.com');
assert.equal(normalizeEndpoint('http://localhost:8899'), 'http://localhost:8899');

// The precedence that matters: stored choice, then build-time, then public.
assert.equal(initialEndpoint('https://stored.example', 'https://built.example'), 'https://stored.example');
assert.equal(initialEndpoint(null, 'https://built.example'), 'https://built.example');
assert.equal(initialEndpoint('', 'https://built.example'), 'https://built.example');
assert.equal(initialEndpoint('', ''), PUBLIC_RPC, 'an empty build-time value must fall back, not crash');
assert.equal(initialEndpoint(undefined, undefined), PUBLIC_RPC);

unlinkSync('.rpc.test.mjs');
console.log('rpc endpoint handling: all assertions passed');
