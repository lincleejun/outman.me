import assert from 'node:assert/strict';

const base = process.argv[2] || 'https://outman.cc';
const page = await fetch(`${base}/birding/`);
assert.equal(page.status, 200, 'birding page must be reachable');
assert.match(await page.text(), /消息时间线/, 'expected birding page, not a fallback');
const response = await fetch(`${base}/birding/feed.json`, {cache:'no-store'});
assert.equal(response.status, 200, 'static feed must be reachable');
const feed = await response.json();
assert.equal(feed.schema_version, 1);
assert.ok(Array.isArray(feed.items));
assert.equal(new Set(feed.items.map(item => item.id)).size, feed.items.length, 'duplicate source IDs');
for (let i = 1; i < feed.items.length; i++) {
  assert.ok(feed.items[i - 1].reported_at >= feed.items[i].reported_at, 'reports must be newest first');
}
assert.equal(feed.stats.total, feed.items.length);
assert.equal(feed.sources.sialia.status, 'ok', 'source collection must be healthy');
const age = Date.now() - Date.parse(feed.sources.sialia.last_success_at);
assert.ok(Number.isFinite(age) && age < 3 * 60 * 60 * 1000, 'feed must have a successful update within 3 hours');
console.log(`OK: ${feed.items.length} unique reports, newest first; last successful collection ${feed.sources.sialia.last_success_at}`);
