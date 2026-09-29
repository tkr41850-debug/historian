/* Node smoke test for web/app.js pure helpers. Runs with plain node, no deps.
 * Usage: node web/smoke.cjs [path/to/historian.json]  (defaults to web/sample.json)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./app.js');

let failures = 0;
function check(name, cond) {
  if (cond) { console.log('PASS ' + name); }
  else { failures++; console.log('FAIL ' + name); }
}
function throws(name, fn) {
  try { fn(); } catch (e) { console.log('PASS ' + name); return; }
  failures++;
  console.log('FAIL ' + name + ' (no throw)');
}

const target = process.argv[2] || path.join(__dirname, '..', 'sample.json');
let raw;
try {
  raw = JSON.parse(fs.readFileSync(target, 'utf8'));
} catch (e) {
  console.error('cannot read ' + target + ' (' + e.code + '); regenerate with `just sample` or pass a historian.json path');
  process.exit(2);
}
const { meta, commits } = H.parseHistory(raw);

check('parses 3 commits', commits.length === 3);
check('trajectory has beta_v', !!(meta.trajectory && typeof meta.trajectory.beta_v === 'number'));
check('permalinks preserved', commits.every((c) => /\/commit\//.test(c.permalink || '')));

const byErosion = H.sortCommits(commits, 'erosion', -1);
const erosions = byErosion.map((c) => (c.commit.erosion || 0));
check('erosion desc non-increasing', erosions.every((v, i) => i === 0 || erosions[i - 1] >= v));
check('erosion desc ties break by commit order', H.sortCommits(
  [{ _idx: 5, commit: { erosion: 1 } }, { _idx: 3, commit: { erosion: 1 } }], 'erosion', -1
).map((c) => c._idx).join(',') === '3,5');
const bySubject = H.sortCommits(commits, 'subject', 1);
const subjects = bySubject.map((c) => c.subject);
check('subject asc alphabetical', JSON.stringify(subjects) === JSON.stringify([...subjects].sort()));
const byIdx = H.sortCommits(commits, 'idx', 1);
check('idx asc restores commit order', byIdx.map((c) => c._idx).join(',') === '0,1,2');
check('sort does not mutate input', commits[0]._idx === 0 && commits.length === 3);

check('fmtDate(0) is dash', H.fmtDate(0) === '—');
check('fmtDate deterministic', H.fmtDate(1700000000) === '2023-11-14');
check('fmtPct', H.fmtPct(0.12345) === '12.3%');
check('shortSha', H.shortSha('abcdef123456') === 'abcdef12');
check('esc quotes', H.esc('<a href="x">') === '&lt;a href=&quot;x&quot;&gt;');

throws('rejects null', () => H.parseHistory(null));
throws('rejects missing commits', () => H.parseHistory({}));
throws('rejects non-object commit', () => H.parseHistory({ commits: [42] }));
throws('rejects unknown sort key', () => H.sortCommits(commits, 'nope', 1));
check('empty commits ok', H.parseHistory({ commits: [] }).commits.length === 0);
check('missing commit.metrics default to 0 cells',
  H.cellValue({ _idx: 0, commit: {} }, 'erosion') === '0.0%');

if (failures) { console.error(failures + ' failure(s)'); process.exit(1); }
console.log('smoke OK: ' + commits.length + ' commits from ' + target);
