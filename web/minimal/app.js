/* Historian minimal table lens — dependency-free.
 *
 * Pure helpers (parse/sort/format) are exported for the node smoke test;
 * DOM wiring only runs where `document` exists, so this file loads both
 * as a classic browser <script> and via require() in node.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Historian = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLUMNS = [
    { key: 'idx', label: '#', numeric: true, get: function (c) { return c._idx; } },
    { key: 'time', label: 'Date', get: function (c) { return c.time || 0; } },
    { key: 'subject', label: 'Subject', get: function (c) { return (c.subject || '').toLowerCase(); } },
    { key: 'author', label: 'Author', get: function (c) { return (c.author || '').toLowerCase(); } },
    { key: 'loc', label: 'LOC', numeric: true, get: function (c) { return num(c.commit, 'loc'); } },
    { key: 'verbosity', label: 'Verbosity', numeric: true, get: function (c) { return num(c.commit, 'verbosity'); } },
    { key: 'erosion', label: 'Erosion', numeric: true, get: function (c) { return num(c.commit, 'erosion'); } },
    { key: 'functions', label: 'Fns', numeric: true, get: function (c) { return num(c.commit, 'functions'); } },
    { key: 'cc_avg', label: 'CC avg', numeric: true, get: function (c) { return num(c.commit, 'cc_avg'); } }
  ];

  function num(obj, key) {
    return obj && typeof obj[key] === 'number' ? obj[key] : 0;
  }

  function parseHistory(data) {
    if (!data || typeof data !== 'object') throw new Error('Not a JSON object.');
    if (!Array.isArray(data.commits)) throw new Error('Missing "commits" array — is this a historian.json?');
    var commits = data.commits.map(function (c, i) {
      if (!c || typeof c !== 'object') throw new Error('Commit #' + i + ' is not an object.');
      return {
        sha: String(c.sha || ''),
        author: String(c.author || ''),
        email: String(c.email || ''),
        time: typeof c.time === 'number' ? c.time : 0,
        subject: String(c.subject || ''),
        body: String(c.body || ''),
        permalink: c.permalink || null,
        files: c.files && typeof c.files === 'object' ? c.files : {},
        repo: c.repo && typeof c.repo === 'object' ? c.repo : {},
        commit: c.commit && typeof c.commit === 'object' ? c.commit : {},
        _idx: i
      };
    });
    var meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
    return { meta: meta, commits: commits };
  }

  function sortCommits(commits, key, dir) {
    var col = null;
    for (var i = 0; i < COLUMNS.length; i++) {
      if (COLUMNS[i].key === key) col = COLUMNS[i];
    }
    if (!col) throw new Error('Unknown sort key: ' + key);
    var d = dir === -1 ? -1 : 1;
    return commits.slice().sort(function (a, b) {
      var va = col.get(a), vb = col.get(b);
      if (va < vb) return -1 * d;
      if (va > vb) return 1 * d;
      return a._idx - b._idx; // stable tiebreak: original commit order
    });
  }

  function fmtPct(x) {
    return (100 * (typeof x === 'number' ? x : 0)).toFixed(1) + '%';
  }

  function fmtFloat(x) {
    return (typeof x === 'number' ? x : 0).toFixed(2);
  }

  function fmtInt(x) {
    return String(Math.round(typeof x === 'number' ? x : 0));
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }

  function shortSha(sha) {
    return sha ? String(sha).slice(0, 8) : '—';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function cellValue(commit, key) {
    switch (key) {
      case 'idx': return esc(commit._idx);
      case 'time': return esc(fmtDate(commit.time));
      case 'subject': return esc(commit.subject);
      case 'author': return esc(commit.author);
      case 'loc': return esc(fmtInt(num(commit.commit, 'loc')));
      case 'verbosity': return esc(fmtPct(num(commit.commit, 'verbosity')));
      case 'erosion': return esc(fmtPct(num(commit.commit, 'erosion')));
      case 'functions': return esc(fmtInt(num(commit.commit, 'functions')));
      case 'cc_avg': return esc(fmtFloat(num(commit.commit, 'cc_avg')));
      default: return '';
    }
  }

  // ---- DOM wiring (browser only) ----

  function boot() {
    var state = { data: null, sortKey: 'idx', sortDir: 1 };
    var drop = document.getElementById('drop');
    var fileInput = document.getElementById('file');
    var sampleBtn = document.getElementById('sample');
    var status = document.getElementById('status');
    var empty = document.getElementById('empty');
    var summary = document.getElementById('summary');
    var table = document.getElementById('commits');
    var thead = document.getElementById('chead');
    var tbody = document.getElementById('cbody');
    var drawer = document.getElementById('drawer');
    var dBody = document.getElementById('dbody');
    var dClose = document.getElementById('dclose');

    function setStatus(msg) { status.textContent = msg; }

    function renderHead() {
      var html = '<tr>';
      COLUMNS.forEach(function (col) {
        var arrow = state.sortKey === col.key ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '';
        var aria = state.sortKey === col.key ? (state.sortDir === 1 ? 'ascending' : 'descending') : 'none';
        html += '<th data-key="' + col.key + '" aria-sort="' + aria + '" tabindex="0" role="columnheader"' +
          (col.numeric ? ' class="num"' : '') + '>' + esc(col.label) + esc(arrow) + '</th>';
      });
      html += '</tr>';
      thead.innerHTML = html;
    }

    function render() {
      if (!state.data) return;
      renderHead();
      var rows = sortCommits(state.data.commits, state.sortKey, state.sortDir);
      var html = '';
      rows.forEach(function (c) {
        html += '<tr data-sha="' + esc(c.sha) + '" tabindex="0">';
        COLUMNS.forEach(function (col) {
          html += '<td' + (col.numeric ? ' class="num"' : '') + '>' + cellValue(c, col.key) + '</td>';
        });
        html += '</tr>';
      });
      tbody.innerHTML = html;
      table.hidden = rows.length === 0;
      empty.hidden = rows.length !== 0;
    }

    function renderSummary() {
      var t = (state.data.meta && state.data.meta.trajectory) || {};
      summary.hidden = false;
      summary.innerHTML =
        '<strong>' + state.data.commits.length + ' commits</strong>' +
        ' · ΔV ' + esc(fmtPct(t.delta_v)) + ' · ΔE ' + esc(fmtPct(t.delta_e)) +
        ' · βV ' + esc(fmtFloat(t.beta_v)) + ' · βE ' + esc(fmtFloat(t.beta_e));
    }

    function openDrawer(sha) {
      var c = null;
      state.data.commits.forEach(function (x) { if (x.sha === sha) c = x; });
      if (!c) return;
      var files = Object.keys(c.files || {});
      var fhtml = files.length ? '<table class="files"><thead><tr><th>File</th><th>Plugin</th><th>Metrics</th></tr></thead><tbody>' : '<p>No files recorded.</p>';
      files.forEach(function (path) {
        var plugins = c.files[path] || {};
        Object.keys(plugins).forEach(function (p) {
          var m = JSON.stringify(plugins[p]);
          if (m.length > 140) m = m.slice(0, 140) + '…';
          fhtml += '<tr><td>' + esc(path) + '</td><td>' + esc(p) + '</td>' +
            '<td class="mono" title="' + esc(JSON.stringify(plugins[p])) + '">' + esc(m) + '</td></tr>';
        });
      });
      if (files.length) fhtml += '</tbody></table>';
      dBody.innerHTML =
        '<h2>' + esc(c.subject || '(no subject)') + '</h2>' +
        '<dl>' +
        '<dt>SHA</dt><dd class="mono">' + esc(c.sha) + '</dd>' +
        '<dt>Author</dt><dd>' + esc(c.author) + (c.email ? ' &lt;' + esc(c.email) + '&gt;' : '') + '</dd>' +
        '<dt>Date</dt><dd>' + esc(fmtDate(c.time)) + '</dd>' +
        (c.permalink ? '<dt>Link</dt><dd><a href="' + esc(c.permalink) + '">permalink</a></dd>' : '') +
        '<dt>LOC / Verbosity / Erosion</dt><dd>' + esc(fmtInt(num(c.commit, 'loc'))) + ' / ' +
        esc(fmtPct(num(c.commit, 'verbosity'))) + ' / ' + esc(fmtPct(num(c.commit, 'erosion'))) + '</dd>' +
        '<dt>Functions / CC avg</dt><dd>' + esc(fmtInt(num(c.commit, 'functions'))) + ' / ' +
        esc(fmtFloat(num(c.commit, 'cc_avg'))) + '</dd>' +
        '</dl>' +
        (c.body ? '<h3>Body</h3><pre>' + esc(c.body) + '</pre>' : '') +
        '<h3>Files (' + files.length + ')</h3>' + fhtml;
      drawer.hidden = false;
      dClose.focus();
    }

    function closeDrawer() { drawer.hidden = true; }

    function loadData(obj, name) {
      setStatus('Parsing ' + name + '…');
      var parsed;
      try {
        parsed = parseHistory(obj);
      } catch (e) {
        table.hidden = true;
        summary.hidden = true;
        empty.hidden = true;
        setStatus('Error: ' + e.message);
        return;
      }
      state.data = parsed;
      state.sortKey = 'idx';
      state.sortDir = 1;
      closeDrawer();
      if (parsed.commits.length === 0) {
        table.hidden = true;
        summary.hidden = true;
        empty.hidden = false;
        setStatus('Loaded ' + name + ': 0 commits — nothing to show.');
        return;
      }
      empty.hidden = true;
      renderSummary();
      render();
      setStatus('Loaded ' + name + ': ' + parsed.commits.length + ' commits. Click a column to sort, a row for detail.');
    }

    function loadFile(f) {
      if (!f) return;
      setStatus('Reading ' + f.name + '…');
      var r = new FileReader();
      r.onload = function () {
        var obj;
        try {
          obj = JSON.parse(r.result);
        } catch (e) {
          setStatus('Error: ' + f.name + ' is not valid JSON.');
          return;
        }
        loadData(obj, f.name);
      };
      r.onerror = function () { setStatus('Error: could not read ' + f.name + '.'); };
      r.readAsText(f);
    }

    thead.addEventListener('click', function (e) {
      var th = e.target.closest('th');
      if (!th) return;
      var key = th.getAttribute('data-key');
      if (state.sortKey === key) state.sortDir *= -1;
      else { state.sortKey = key; state.sortDir = 1; }
      render();
    });
    thead.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var th = e.target.closest('th');
        if (th) { th.click(); e.preventDefault(); }
      }
    });
    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (tr) openDrawer(tr.getAttribute('data-sha'));
    });
    tbody.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var tr = e.target.closest('tr');
        if (tr) openDrawer(tr.getAttribute('data-sha'));
      }
    });
    dClose.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files.length) loadFile(fileInput.files[0]);
    });
    sampleBtn.addEventListener('click', function () {
      setStatus('Loading sample…');
      fetch('../sample.json').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (obj) { loadData(obj, 'sample.json'); })
        .catch(function () {
          setStatus('Error: sample.json not reachable (file:// blocks fetch — serve over http or pick a file).');
        });
    });

    setStatus('No data loaded. Drop a historian.json above, choose a file, or load the sample.');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  return {
    COLUMNS: COLUMNS,
    parseHistory: parseHistory,
    sortCommits: sortCommits,
    fmtPct: fmtPct,
    fmtFloat: fmtFloat,
    fmtInt: fmtInt,
    fmtDate: fmtDate,
    shortSha: shortSha,
    cellValue: cellValue,
    esc: esc
  };
});
