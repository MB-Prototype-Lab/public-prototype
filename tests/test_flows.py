import importlib.util
import json
import re
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('flows', Path(__file__).resolve().parents[1] / 'scripts/flows.py')
flows = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flows)


class FlowsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='contained flows ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.email', 'test@example.com')
        self.git('config', 'user.name', 'Test')
        self.write('app/index.html', '<script src="release-config.js"></script><script src="js/refresh-pin.js"></script><script src="js/config.js"></script><script src="js/boot.js"></script><script src="js/navigation.js"></script>')
        self.write('app/release-config.js', '')
        self.write('app/js/refresh-pin.js', '')
        self.write('app/js/config.js', '')
        self.write('app/js/navigation.js', 'bootApp();')
        self.write('app/js/boot.js', 'function bootApp() {}\nfunction appEntryScreen() {}\n')
        # Only the destinations registry declares screens; other arrays in state.js do not.
        self.write('app/js/state.js', 'const destinations = [\n  ["onboarding", "Onboarding"],\n  ["goals", "Goals"]\n];\nconst quizAnswers = [["Retirement", "Saving for later"]];\n')
        self.write('app/css/keyboard.css', '')
        self.write('app/docs/excluded.json', '{}')
        self.write('app/.secret', 'hidden')
        self.write('app/source.py', 'not static')
        self.git('add', '.')
        self.git('commit', '-m', 'baseline')
        self.base = self.git('rev-parse', 'HEAD').strip()
        flows.catalog(self.root)

    def git(self, *args):
        return flows.git(self.root, *args).decode()

    def write(self, path, data):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data)
        return target

    def create(self, ident='sample'):
        flows.create(self.root, ident, self.base, 'Sample <label>', 'Purpose')

    def inventory(self):
        return {str(p.relative_to(self.root / 'app')): p.read_bytes() for p in (self.root / 'app').rglob('*') if p.is_file()}

    def test_committed_only_export_contained_and_app_unchanged(self):
        self.write('app/js/config.js', '// dirty')
        self.write('app/untracked.js', '// untracked')
        before = self.inventory()
        self.create()
        flows.check(self.root)
        package = self.root / 'flows/sample'
        self.assertEqual((package / 'js/config.js').read_text(), '')
        for absent in ('docs', '.secret', 'source.py', 'untracked.js'):
            self.assertFalse((package / absent).exists())
        self.assertEqual(before, self.inventory())
        self.assertEqual(json.loads((package / 'flow.json').read_text())['allowed_screens'], ['onboarding'])
        self.assertTrue((package / 'js/flow-tools.js').exists())
        self.assertTrue((package / 'css/flow-tools.css').exists())
        runtime = (package / 'js/flow.js').read_text()
        self.assertIn('state.adminCollapsed = true', runtime)
        self.assertIn('screen === "onboarding"', runtime)
        self.assertNotIn('mbFlowRestart()', (package / 'index.html').read_text())
        self.assertIn('function mbFlowRestart() { refreshPinRestart(); }', runtime)
        self.assertTrue((package / 'js/refresh-pin.js').exists())
        self.assertLess((package / 'index.html').read_text().index('flow-config.js'), (package / 'index.html').read_text().index('js/config.js'))

    def test_unsafe_ids_sources_and_collisions_preserve_catalog(self):
        before = (self.root / 'flows/catalog.js').read_bytes()
        for ident in ('../app', 'A', '-a', 'a/b', 'a..b', 'a' * 65):
            with self.subTest(ident=ident), self.assertRaisesRegex(ValueError, '^ID must be lowercase kebab-case, at most 64 characters$'):
                self.create(ident)
        with self.assertRaisesRegex(ValueError, '^source must be an existing full commit SHA'):
            flows.create(self.root, 'sample', 'HEAD', 'x', 'x')
        self.assertEqual(before, (self.root / 'flows/catalog.js').read_bytes())
        self.create()
        package = (self.root / 'flows/sample/flow.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'flows/sample: destination exists; choose another ID, never overwrite a Flow$'):
            self.create()
        self.assertEqual(package, (self.root / 'flows/sample/flow.json').read_bytes())

    def test_linked_source_and_failed_catalog_roll_back(self):
        self.write('outside.js', 'outside')
        (self.root / 'app/link.js').symlink_to('../outside.js')
        self.git('add', 'app/link.js')
        self.git('commit', '-m', 'link')
        linked = self.git('rev-parse', 'HEAD').strip()
        with self.assertRaisesRegex(ValueError, 'linked'):
            flows.create(self.root, 'linked', linked, 'x', 'x')
        self.assertFalse((self.root / 'flows/linked').exists())
        before = (self.root / 'flows/catalog.js').read_bytes()
        with patch.object(flows, 'atomic_write', side_effect=OSError('interrupted')):
            with self.assertRaisesRegex(OSError, '^interrupted$'):
                self.create()
        self.assertFalse((self.root / 'flows/sample').exists())
        self.assertEqual(before, (self.root / 'flows/catalog.js').read_bytes())
        self.assertFalse(list((self.root / 'flows').glob('.creating-*')))

    def test_malformed_source_entry_fails_before_install(self):
        self.write('app/index.html', '<script src="release-config.js"></script><script src="js/config.js"></script>')
        self.git('add', 'app/index.html')
        self.git('commit', '-m', 'malformed source missing navigation entry')
        broken = self.git('rev-parse', 'HEAD').strip()
        before = {p.name: p.read_bytes() for p in (self.root / 'flows').iterdir()}
        with self.assertRaisesRegex(ValueError, 'required configuration/runtime'):
            flows.create(self.root, 'broken', broken, 'Broken', 'Bad entry')
        self.assertFalse((self.root / 'flows/broken').exists())
        self.assertEqual(before, {p.name: p.read_bytes() for p in (self.root / 'flows').iterdir()})

    def test_source_without_refresh_pin_fails_before_install(self):
        # A Flow from an app commit predating the shared refresh pin would keep an
        # unconditional redirect and a Restart that calls a missing function.
        for html in ('<script src="release-config.js"></script><script src="js/config.js"></script><script src="js/navigation.js"></script>',
                     '<script src="release-config.js"></script><script src="js/config.js"></script><script src="js/refresh-pin.js"></script><script src="js/navigation.js"></script>'):
            with self.subTest(html=html):
                self.write('app/index.html', html)
                self.git('add', 'app/index.html')
                self.git('commit', '-m', 'refresh pin missing or late')
                source = self.git('rev-parse', 'HEAD').strip()
                with self.assertRaisesRegex(ValueError, 'refresh-pin|policy must load'):
                    flows.create(self.root, 'stale', source, 'Stale', 'Old source')
                self.assertFalse((self.root / 'flows/stale').exists())

    def test_unsupported_boot_anchors_preserve_packages_and_discovery(self):
        self.create()
        before = {str(p.relative_to(self.root / 'flows')): p.read_bytes()
                  for p in (self.root / 'flows').rglob('*') if p.is_file()}
        fixtures = [('', 'function bootApp() {}\nfunction appEntryScreen() {}'),
                    ('bootUnknown();', 'function bootUnknown() {}\nfunction appEntryScreen() {}'),
                    ('bootApp();\nbootApp();', 'function bootApp() {}\nfunction appEntryScreen() {}'),
                    ('bootApp();\nbootApp(); // duplicate', 'function bootApp() {}\nfunction appEntryScreen() {}'),
                    ('bootApp();\nbootV3();', 'function bootApp() {}\nfunction appEntryScreen() {}'),
                    ('bootApp();', 'function bootApp() {}'),
                    ('bootApp();', 'function bootApp() {}\nfunction v3EntryScreen() {}'),
                    ('bootApp();', 'function bootApp() {}\nfunction appEntryScreen() {}\nfunction appEntryScreen() {}'),
                    ('bootApp();', 'function bootApp() {}\nfunction appEntryScreen() {}\nfunction v3EntryScreen() {}')]
        for navigation, boot in fixtures:
            with self.subTest(navigation=navigation, boot=boot):
                self.write('app/js/navigation.js', navigation)
                self.write('app/js/boot.js', boot)
                self.git('commit', '-am', 'unsupported boot shape')
                source = self.git('rev-parse', 'HEAD').strip()
                with self.assertRaisesRegex(ValueError, '^unsupported source boot/entry anchors:'):
                    flows.create(self.root, 'unsupported', source, 'Unsupported', 'Bad anchors')
                self.assertFalse((self.root / 'flows/unsupported').exists())
                self.assertFalse(list((self.root / 'flows').glob('.creating-*')))
                after = {str(p.relative_to(self.root / 'flows')): p.read_bytes()
                         for p in (self.root / 'flows').rglob('*') if p.is_file()}
                self.assertEqual(before, after)

    def test_boot_script_must_load_once_before_the_flow_override(self):
        html = (self.root / 'app/index.html').read_text()
        tag = '<script src="js/boot.js"></script>'
        for entry in (html.replace(tag, ''), html.replace(tag, tag + tag),
                      html.replace(tag, '').replace('<script src="js/navigation.js"></script>',
                                                   '<script src="js/navigation.js"></script>' + tag)):
            with self.subTest(entry=entry):
                self.write('app/index.html', entry)
                self.git('commit', '-am', 'unsupported boot script order')
                source = self.git('rev-parse', 'HEAD').strip()
                before = (self.root / 'flows/catalog.js').read_bytes()
                with self.assertRaisesRegex(ValueError, 'required configuration/runtime|policy must load'):
                    flows.create(self.root, 'bad-order', source, 'Bad order', 'Boot script regression')
                self.assertFalse((self.root / 'flows/bad-order').exists())
                self.assertEqual(before, (self.root / 'flows/catalog.js').read_bytes())

    def test_scope_covers_staged_unstaged_untracked_and_integration(self):
        self.assertEqual(flows.scope(self.root, 'flow'), ('main', self.base))
        self.write('app/new.js', 'new')
        with self.assertRaisesRegex(ValueError, 'Flow scope changes app/ .*: app/new.js'):
            flows.scope(self.root, 'flow')
        flows.scope(self.root, 'app-integration')
        self.git('add', 'app/new.js')
        with self.assertRaisesRegex(ValueError, 'Flow scope changes app/ .*: app/new.js'):
            flows.scope(self.root, 'flow')

    def test_scope_passes_main_merged_in_and_rejects_own_app_edits(self):
        self.git('switch', '-q', '-c', 'work/flow-task')
        self.write('notes.txt', 'Flow task work')
        self.git('add', 'notes.txt')
        self.git('commit', '-m', 'task work')
        self.git('switch', '-q', 'main')
        self.write('app/js/config.js', '// main moved on')
        self.git('commit', '-am', 'main app change')
        main = self.git('rev-parse', 'HEAD').strip()
        self.git('switch', '-q', 'work/flow-task')
        self.git('merge', '-q', '--no-edit', 'main')
        # Diffing from the task's starting commit would blame main's change on the task.
        self.assertEqual(self.git('diff', '--name-only', self.base, '--', 'app'), 'app/js/config.js\n')
        self.assertEqual(flows.scope(self.root, 'flow'), ('main', main))
        # Main moving on again does not count against the task before its next sync.
        self.git('switch', '-q', 'main')
        self.write('app/css/keyboard.css', '/* main moved on again */')
        self.git('add', 'app/css/keyboard.css')
        self.git('commit', '-m', 'later main app change')
        self.git('switch', '-q', 'work/flow-task')
        self.assertEqual(flows.scope(self.root, 'flow'), ('main', main))
        # The default prefers origin/main; one older than the merged main needs --against.
        self.git('update-ref', 'refs/remotes/origin/main', self.base)
        with self.assertRaisesRegex(ValueError, r'merge base of origin/main and HEAD\): app/js/config\.js\. .*--against .*never revert main'):
            flows.scope(self.root, 'flow')
        self.assertEqual(flows.scope(self.root, 'flow', 'main'), ('main', main))
        with self.assertRaisesRegex(ValueError, "--against 'missing' is not a commit"):
            flows.scope(self.root, 'flow', 'missing')
        self.write('app/js/navigation.js', 'bootApp(); // task edit')
        self.git('commit', '-am', 'own app edit')
        with self.assertRaisesRegex(ValueError, r'merge base of main and HEAD\): app/js/navigation\.js\. '):
            flows.scope(self.root, 'flow', 'main')
        flows.scope(self.root, 'app-integration', 'main')

    def test_stale_metadata_symlink_and_invalid_policy(self):
        self.create()
        target = self.root / 'flows/sample/flow-config.js'
        target.write_text('stale')
        with self.assertRaisesRegex(ValueError, 'stale'):
            flows.check(self.root)
        flows.catalog(self.root)
        target.unlink()
        outside = self.write('outside', 'unchanged')
        target.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            flows.catalog(self.root)
        self.assertEqual(outside.read_text(), 'unchanged')
        m = json.loads((self.root / 'flows/sample/flow.json').read_text())
        m['allowed_screens'] = ['goals']
        with self.assertRaisesRegex(ValueError, r'^flow\.json \(sample\): entry/completion must be in a unique allowlist$'):
            flows.validate_metadata(m, 'sample')

    def test_scope_refuses_a_shallow_clone(self):
        self.write('app/js/config.js', '// second commit')
        self.git('commit', '-am', 'second')
        clone = self.root / 'shallow'
        subprocess.run(['git', 'clone', '-q', '--depth', '1', (self.root).as_uri(), str(clone)], check=True, capture_output=True)
        for against in (None, 'origin/main'):
            with self.subTest(against=against), self.assertRaisesRegex(ValueError, '^this clone is shallow.*git fetch --unshallow'):
                flows.scope(clone, 'app-integration', against)

    def test_allowed_screens_must_be_in_the_destinations_registry(self):
        self.create()
        package = self.root / 'flows/sample'
        m = json.loads((package / 'flow.json').read_text())
        m['allowed_screens'] = ['onboarding', 'goals']
        (package / 'flow.json').write_text(json.dumps(m))
        flows.catalog(self.root)
        flows.check(self.root)
        m['allowed_screens'].append('Retirement')
        (package / 'flow.json').write_text(json.dumps(m))
        flows.catalog(self.root)
        with self.assertRaisesRegex(ValueError, 'allowed_screens not in the js/state.js destinations registry: Retirement$'):
            flows.check(self.root)
        (package / 'js/state.js').write_text('const screens = [["Retirement", "Retirement"]];\n')
        with self.assertRaisesRegex(ValueError, 'no "const destinations = \\[...\\];" screen registry'):
            flows.check(self.root)
        (package / 'js/state.js').unlink()
        with self.assertRaisesRegex(ValueError, 'missing js/state.js'):
            flows.check(self.root)

    def test_scope_rejects_staged_change_when_worktree_matches_base(self):
        self.write('app/js/config.js', '// staged product change')
        self.git('add', 'app/js/config.js')
        self.write('app/js/config.js', '')
        with self.assertRaisesRegex(ValueError, 'Flow scope changes app/ .*: app/js/config.js'):
            flows.scope(self.root, 'flow')
        flows.scope(self.root, 'app-integration')

    def test_dependencies_negative_and_dynamic_prefixes(self):
        valid = {'index.html': b'<script src="js/main.js"></script>', 'js/main.js': b'const asset = `assets/img/${name}.png`;', 'assets/img/example.png': b'image'}
        flows.validate_dependencies(valid)
        def rejects(name, text, message):
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, '/' + re.escape(name + ': ' + message) + '$'):
                flows.validate_dependencies({name: text.encode()})
        for html, message in (('<script src="../app/js/main.js"></script>', "traversal dependency '../app/js/main.js'"),
                              ('<img src="/tmp/a.png">', "forbidden dependency '/tmp/a.png'"),
                              ('<script src="https://evil.test/a.js"></script>', "forbidden dependency 'https://evil.test/a.js'"),
                              ('<link href="../../index.html" rel="stylesheet">', "traversal dependency '../../index.html'"),
                              ('<img src="%2e%2e/app/a.png">', "traversal dependency '../app/a.png'"),
                              # Only the selector exit is exempt; an escaping link with no
                              # file extension is seen by the anchor check alone.
                              ('<a href="../../">Selector folder</a>', "traversal dependency '../../'"),
                              ('<a href="../../../app/">App</a>', "traversal dependency '../../../app/'")):
            rejects('index.html', html, message)
        for js, message in (('const x="assets/missing/";', "missing dependency 'assets/missing'"),
                            ('const x="../app/a.js";', "traversal dependency '../app/a.js'"),
                            ('const x="flows/other/a.js";', "missing dependency 'flows/other/a.js'"),
                            ('const x="assets/../a.png";', "traversal dependency 'assets/../a.png'"),
                            ('const x="file:///tmp/a.png";', "forbidden dependency 'file:///tmp/a.png'"),
                            ('const x="//server/a.js";', "forbidden dependency '//server/a.js'"),
                            ('const html=`<img src="assets/missing.png">`;', "missing dependency 'assets/missing.png'")):
            rejects('js/main.js', js, message)
        flows.validate_dependencies({'index.html': b'<a href="../../index.html">Exit</a>'})
        flows.validate_dependencies({'screens/onboarding.js': b'const x="assets/audio/onboarding/";'})
        rejects('screens/other.js', 'const x="assets/audio/onboarding/";', "missing dependency 'assets/audio/onboarding'")

    def test_catalog_write_failure_restores_both_discovery_files(self):
        self.create()
        paths = [self.root / 'flows/catalog.json', self.root / 'flows/catalog.js', self.root / 'flows/sample/flow-config.js']
        before = {p: p.read_bytes() for p in paths}
        real = flows.atomic_write
        calls = []
        def interrupted(path, content):
            calls.append(path)
            if len(calls) == 3:
                raise OSError('interrupted')
            real(path, content)
        with patch.object(flows, 'atomic_write', side_effect=interrupted):
            with self.assertRaisesRegex(OSError, '^interrupted$'):
                flows.catalog(self.root)
        self.assertEqual(before, {p: p.read_bytes() for p in paths})


class GeneratedFlowRuntimeTest(unittest.TestCase):
    def test_non_executable_anchors_fail_before_install(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='unsupported flow runtime ') as temporary:
            root = Path(temporary)
            archive = flows.git(repo, 'archive', '--format=tar', 'HEAD', 'app')
            subprocess.run(['tar', '-xf', '-', '-C', str(root)], input=archive, check=True)
            def git(*args):
                return flows.git(root, *args).decode().strip()
            git('init', '-b', 'main')
            git('config', 'user.email', 'test@example.com')
            git('config', 'user.name', 'Test')
            nav, boot = root / 'app/js/navigation.js', root / 'app/js/boot.js'
            navigation, boot_source = nav.read_text(), boot.read_text()
            flows.catalog(root)
            before = {name: (root / 'flows' / name).read_bytes() for name in ('catalog.js', 'catalog.json')}
            fake_calls = ['/*\nbootApp();\n*/\nbootApp.call(null);',
                          'var note = `\nbootApp();\n`;\nbootApp.call(null);',
                          'var note = "bootApp();";\nbootApp.call(null);',
                          'function unusedBoot() {\nbootApp();\n}\nbootApp.call(null);',
                          'if (false) {\nbootApp();\n}\nbootApp.call(null);',
                          'if (false)\nbootApp();\nelse window["bootApp"].call(null);']
            fixtures = [(navigation.replace('\nbootApp();\n', '\n' + fake + '\n'), boot_source)
                        for fake in fake_calls]
            for name in ('bootApp', 'appEntryScreen'):
                declaration = 'function ' + name + '() {'
                fixtures.append((navigation, boot_source.replace(declaration,
                    '/* ' + declaration + '} */\nvar ' + name + ' = function () {')))
                fixtures.append((navigation, boot_source.replace(declaration,
                    'var ' + name + ' = ' + declaration)))
            for navigation_fixture, boot_fixture in fixtures:
                with self.subTest(navigation=navigation_fixture[-100:], boot=boot_fixture[:100]):
                    nav.write_text(navigation_fixture)
                    boot.write_text(boot_fixture)
                    git('add', 'app')
                    git('commit', '-m', 'unsupported executable anchor shape')
                    # Each source still boots successfully. Reject it rather
                    # than silently generate a package with unrestricted go().
                    result = subprocess.run(['node', '-e', r'''
const assert = require('node:assert/strict');
const {loadApp} = require(process.argv[1]);
const app = loadApp({folder: process.argv[2]});
assert.equal(app.run('state.screen'), 'onboarding');
app.run('go("home")');
assert.equal(app.run('state.screen'), 'home');
assert.deepEqual(app.log.errors, []);
''', str(repo / 'tests/lib/app-vm.cjs'), str(root / 'app')], capture_output=True, text=True)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    with self.assertRaisesRegex(ValueError, '^unsupported source boot/entry anchors:'):
                        flows.create(root, 'unsupported', git('rev-parse', 'HEAD'), 'Unsupported', 'Fake anchors')
                    self.assertFalse((root / 'flows/unsupported').exists())
                    self.assertFalse(list((root / 'flows').glob('.creating-*')))
                    self.assertEqual(before, {name: (root / 'flows' / name).read_bytes() for name in before})

    def test_current_and_historical_sources_boot_with_containment(self):
        repo = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='generated flow runtime ') as temporary:
            root = Path(temporary)
            # Use real app bytes without relying on a historical commit being
            # present in a clone. The second source changes only the boot names.
            archive = flows.git(repo, 'archive', '--format=tar', 'HEAD', 'app')
            subprocess.run(['tar', '-xf', '-', '-C', str(root)], input=archive, check=True)
            def git(*args):
                return flows.git(root, *args).decode().strip()
            git('init', '-b', 'main')
            git('config', 'user.email', 'test@example.com')
            git('config', 'user.name', 'Test')
            flows.catalog(root)
            for ident, boot_name, entry_name in [('current', 'bootApp', 'appEntryScreen'),
                                                 ('historical', 'bootV3', 'v3EntryScreen')]:
                if ident == 'historical':
                    for name in ('boot.js', 'navigation.js'):
                        path = root / 'app/js' / name
                        path.write_text(path.read_text().replace('bootApp', boot_name).replace('appEntryScreen', entry_name))
                git('add', 'app')
                git('commit', '-m', ident + ' source')
                source = git('rev-parse', 'HEAD')
                flows.create(root, ident, source, ident, 'Runtime containment regression')
                flows.check(root, ident)
                package = root / 'flows' / ident
                self.assertEqual((package / 'js/navigation.js').read_text().count('mbFlowInstall();'), 1)
                result = subprocess.run(['node', '-e', r'''
const assert = require('node:assert/strict');
const {loadApp} = require(process.argv[1]);
for (const href of ['https://prototype.example/flows/test/index.html',
                    'https://prototype.example/flows/test/index.html?screen=home']) {
  const app = loadApp({folder: process.argv[2], href, sourceOverrides: {
    'js/flow.js': s => s.replace('function mbFlowInstall() {',
      'function mbFlowInstall() { window.__installs = (window.__installs || 0) + 1;')
  }});
  assert.equal(app.run('window.__installs'), 1);
  assert.equal(app.run('state.screen'), 'onboarding');
  assert.equal(app.run(process.argv[3] + '()'), 'onboarding');
  assert.match(app.run(process.argv[3] + '.toString()'), /window.MB_FLOW.entry/);
  for (const action of ['go("home")', 'navGoTab("learn")', 'navGoTabRoot("aboutMe")',
                        'navAdminJump("goals")', 'screenLinkApply()', 'navBack()']) {
    app.run(action);
    assert.equal(app.run('state.screen'), 'onboarding', action);
    assert.equal(app.run('JSON.stringify(state.nav.stacks.home)'), '["onboarding"]', action);
  }
  app.run('mbFlowToolsToggle(true)');
  const tools = app.document.getElementById('adminRoot').innerHTML;
  assert.match(tools, /Flow setup/);
  assert.doesNotMatch(tools, /navAdminJump|Jump to screen/);
  assert.equal(app.document.getElementById('navRoot').innerHTML, '');
  assert.deepEqual(app.log.errors, []);
}
''', str(repo / 'tests/lib/app-vm.cjs'), str(package), entry_name],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class FlowShellParityTest(unittest.TestCase):
    """Committed Flows keep the full app's page shell around the phone."""

    ROOT = Path(__file__).resolve().parents[1]
    PARITY = ('Flow shell parity (docs/app-contracts.md, Hard rules): {} must equal {}, byte for byte. '
              'Make the same change in app/ and in every Flow in one commit; put Flow-only styles '
              'in css/flow-tools.css, never in a shared file or a new stylesheet link.')

    @staticmethod
    def shell(html):
        head = html[:html.index('</head>')]
        head = re.sub(r'  <title>.*</title>\n', '', head)
        header = html[html.index('<div class="admin-header">'):html.index('<div id="adminRoot"')]
        return head, header

    def test_live_flows_match_adapted_app_shell(self):
        with tempfile.TemporaryDirectory(prefix='flow shell ') as temporary:
            starter = Path(temporary)
            (starter / 'js').mkdir()
            (starter / 'index.html').write_text((self.ROOT / 'app/index.html').read_text())
            (starter / 'js/navigation.js').write_text('bootApp();')
            (starter / 'js/boot.js').write_text('function bootApp() {}\nfunction appEntryScreen() {}\n')
            flows.adapt_starter(starter)
            expected = self.shell((starter / 'index.html').read_text())
        self.assertEqual(expected[1].count('>Exit Flow<'), 1)
        self.assertNotIn('Exit Prototype', expected[1])
        self.assertNotIn('On browser refresh', expected[0])
        for package in sorted((self.ROOT / 'flows').glob('*/flow.json')):
            directory = package.parent
            with self.subTest(flow=directory.name):
                self.assertEqual(self.shell((directory / 'index.html').read_text()), expected, self.PARITY.format(
                    f'flows/{directory.name}/index.html head and Tools header', "app/index.html's as scripts/flows.py adapts them"))
                for shared in ('js/refresh-pin.js', 'css/components.css'):
                    self.assertEqual((directory / shared).read_bytes(), (self.ROOT / 'app' / shared).read_bytes(),
                                     self.PARITY.format(f'flows/{directory.name}/{shared}', f'app/{shared}'))


if __name__ == '__main__':
    unittest.main()
