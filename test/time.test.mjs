import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLocal } from '../app/time.js';

const iso = '2026-11-12T03:03:00.000Z';

test('EU locale puts the day before the month, in the viewer zone', () => {
  process.env.TZ = 'Europe/Berlin';
  assert.match(formatLocal(iso, 'de-DE'), /^12\.11\.?,? 04:03:00/);
});

test('US locale keeps month first', () => {
  assert.match(formatLocal(iso, 'en-US'), /^11\/12/);
});
