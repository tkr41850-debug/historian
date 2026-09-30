"""Hardening: graceful imports + CJS/ESM import-cycle coverage."""
import builtins
import importlib
import sys

from historian.plugins.import_cycles import ImportCyclesPlugin, _resolve

P = ImportCyclesPlugin()


def imports_of(path, src):
    from historian.git import lang_of
    return P.analyze_file(path, src, lang_of(path)).file_metrics["imports"]


def resolved(files):
    return P.analyze_repo(files)


# --- ESM ---

def test_esm_static_import_cycle():
    files = {"src/a.js": "import b from './b.js';\n",
             "src/b.js": "import a from './a.js';\n"}
    out = resolved(files)
    assert out["cycle_count"] >= 1
    assert set(out["files_in_cycles"]) == set(files)


def test_esm_extensionless_and_mjs_cjs():
    files = {"src/a.mjs": "import './b';\n",
             "src/b.mjs": "import './a';\n",
             "lib/x.cjs": "import './y';\n",
             "lib/y.cjs": "import './x';\n"}
    out = resolved(files)
    assert out["cycle_count"] >= 2


def test_esm_reexport_chain_cycle():
    files = {"a.js": "export * from './b.js';\n",
             "b.js": "export * from './c.js';\n",
             "c.js": "export { x } from './a.js';\n"}
    out = resolved(files)
    assert out["cycle_count"] >= 1
    assert set(out["files_in_cycles"]) == {"a.js", "b.js", "c.js"}


def test_esm_reexport_variants_detected():
    imps = imports_of("a.ts", "export * as ns from '../utils';\n")
    assert imps and imps[0].endswith("utils")
    imps = imports_of("a.ts", "export type { T } from './types';\n")
    assert imps and imps[0].endswith("types")
    imps = imports_of("a.js", "import './polyfill';\n")
    assert imps and imps[0].endswith("polyfill")


def test_esm_multiline_import():
    src = "import {\n  a,\n  b,\n} from './dep.js';\n"
    imps = imports_of("m.js", src)
    assert any(i.endswith("dep.js") for i in imps)
    files = {"m.js": src, "dep.js": "import x from './m.js';\n"}
    assert resolved(files)["cycle_count"] >= 1


def test_dynamic_import_cycle_and_forms():
    files = {"a.js": "const m = await import('./lazy.js');\n",
             "lazy.js": "import './a.js';\n"}
    assert resolved(files)["cycle_count"] >= 1
    # bundler comment + bare call; import.meta must not match
    imps = imports_of("c.js", "import(/* webpackChunkName: \"c\" */ './chunk');\n")
    assert any(i.endswith("chunk") for i in imps)
    assert imports_of("d.js", "const t = import.meta.url;\n") == []


# --- CJS ---

def test_cjs_require_cycle():
    files = {"a.js": "const b = require('./b.js');\n",
             "b.js": "module.exports = require('./a.js');\n"}
    out = resolved(files)
    assert out["cycle_count"] >= 1
    assert set(out["files_in_cycles"]) == {"a.js", "b.js"}


def test_cjs_require_variants():
    imps = imports_of("a.js", "const p = require.resolve('./peer');\n")
    assert any(i.endswith("peer") for i in imps)
    imps = imports_of("a.ts", "import foo = require('./foo');\n")
    assert any(i.endswith("foo") for i in imps)
    # bare export assignments reference no module: no edge, no crash
    assert imports_of("e.js", "module.exports = { a: 1 };\n") == []
    assert imports_of("e.js", "exports.foo = 42;\n") == []
    assert imports_of("e.ts", "export = Foo;\n") == []


def test_mixed_esm_cjs_cycle():
    files = {"a.js": "import b from './b.js';\n",
             "b.js": "const a = require('./a.js');\n"}
    assert resolved(files)["cycle_count"] >= 1


# --- Unresolvable imports: ignored, never crash, no phantom nodes ---

def test_missing_targets_ignored():
    files = {"a.js": "import './gone.js';\nconst x = require('lodash');\n",
             "b.js": "import './a.js';\n"}
    out = resolved(files)
    assert out["cycle_count"] == 0
    assert out["files_in_cycles"] == []


def test_dynamic_expressions_ignored():
    src = ("require('./' + name);\n"
           "const l = require(`./locale/${lang}.js`);\n"
           "require(path.join(__dirname, './data.json'));\n"
           "import(`./locale/${lang}.js`);\n")
    assert imports_of("a.js", src) == []
    out = resolved({"a.js": src})
    assert out["cycle_count"] == 0


def test_bare_specifiers_and_query_ignored():
    imps = imports_of("a.js", "import 'lodash';\nimport x from 'react';\n")
    out = resolved({"a.js": "import 'lodash';\n"})
    assert out["cycle_count"] == 0
    assert out["files_in_cycles"] == []


def test_resolve_never_raises():
    for raw in ("", "./", ".", "'./' + name", None):
        assert isinstance(_resolve("a.js", raw, "js"), str)


# --- Missing third-party imports degrade gracefully ---

def test_lizard_absent_fallback(monkeypatch):
    import historian.langutil as lu
    monkeypatch.setattr(lu, "_HAS_LIZARD", False)
    from historian.langutil import analyze_functions
    funcs = analyze_functions("a.py", "def f(x):\n    return x\n", "py")
    assert funcs and funcs[0].sloc >= 1
    funcs = analyze_functions("run.sh", "echo hi\n", "sh")
    assert funcs and funcs[0].cc >= 1


def test_broken_plugin_skipped_not_fatal(tmp_path, monkeypatch, capsys):
    import historian.runner as rn
    real_import_module = importlib.import_module

    def fake_import_module(name):
        if name.endswith(".broken"):
            raise ImportError("No module named 'definitely_missing_xyz'")
        return real_import_module(name)

    monkeypatch.setattr(importlib, "import_module", fake_import_module)
    plugdir = tmp_path / "plugins"
    plugdir.mkdir()
    (plugdir / "broken.py").write_text("import definitely_missing_xyz\n")
    monkeypatch.setattr(rn, "PLUGIN_DIR", plugdir)
    assert rn.discover_plugins() == []
    assert "skipping plugin broken" in capsys.readouterr().err


def test_tqdm_absent_still_runs(tmp_path):
    import subprocess
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    (repo / "a.py").write_text("x = 1\n")
    subprocess.run(["git", "add", "-A"], cwd=repo, check=True,
                   capture_output=True)
    subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@e.com",
                    "commit", "-m", "init"], cwd=repo, check=True,
                   capture_output=True)
    real_import = builtins.__import__

    def no_tqdm(name, *a, **k):
        if name == "tqdm":
            raise ImportError("No module named 'tqdm'")
        return real_import(name, *a, **k)

    import historian.runner as rn
    orig = builtins.__import__
    builtins.__import__ = no_tqdm
    try:
        data = rn.run(str(repo), {}, progress=True)
    finally:
        builtins.__import__ = orig
    assert len(data["commits"]) == 1
