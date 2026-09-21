import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('publish', Path(__file__).resolve().parents[1]/'scripts/publish.py')
pub = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pub)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'user.name', 'Test')
        for folder in ('versions/v1', 'app'):
            path = self.repo/folder
            path.mkdir(parents=True)
            (path/'index.html').write_text('<script src="release-config.js"></script><img src="assets/a.png">')
            (path/'release-config.js').write_text('window.MB_RELEASE = {tracking:false};')
            (path/'assets').mkdir()
            (path/'assets/a.png').write_bytes(b'\x89PNG\0test')
            (path/'instructions.md').write_text('do not execute me')
        self.git('add', 'app', 'versions')
        self.git('commit', '-m', 'source')
        self.sha = self.git('rev-parse', 'HEAD')
        self.row = dict(id='v1', source_tag='snapshot/v1', commit=self.sha,
                        source_dir='versions/v1', public_path='versions/v1/index.html',
                        format='legacy-v1', tracking=False, digest='0'*64, label='One',
                        description='A build', order=0, state='active', ongoing_study=False)
        self.row['digest'] = pub.digest(pub.package(self.row, self.repo, False))
        self.catalog = dict(schema=1, migration_baseline=self.sha, snapshots=[self.row])
        self.git('tag', 'snapshot/v1', self.sha)
        self.assets = {'index.html': b'<div><!-- CATALOG --></div>', 'gate/gate.js': b'// gate', 'gate/style.css': b'/* gate */'}

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], stderr=subprocess.PIPE, text=True).strip()

    def build(self, **kwargs):
        return pub.build(self.catalog, kwargs.pop('revision', self.sha), self.assets, repo=self.repo, **kwargs)

    def previous(self):
        return json.loads(self.build()['publication-manifest.json'])

    def test_legacy_export_equality_and_determinism(self):
        files = pub.export(self.sha, 'versions/v1', self.repo)
        for path, data in files.items():
            self.assertEqual(data, (self.repo/'versions/v1'/path).read_bytes())
        self.assertEqual(self.build(), self.build())
        self.assertIn('versions/v1/instructions.md', self.build())
        self.assertEqual(self.build(previous=self.previous()), self.build())

    def test_new_release_tracking_and_exclusion(self):
        row = dict(self.row, id='new', source_tag='snapshot/new', source_dir='app',
                   public_path='versions/new/index.html', format='static-v1')
        for tracked in (True, False):
            row['tracking'] = tracked
            files = pub.package(row, self.repo, False)
            config = files['release-config.js'].decode()
            self.assertIn('"tracking":'+str(tracked).lower(), config)
            self.assertIn('../../index.html', config)
            self.assertNotIn('instructions.md', files)
            self.assertEqual(files['assets/a.png'], b'\x89PNG\0test')
        (self.repo/'app/untracked.js').write_text('uncommitted')
        (self.repo/'.worktrees').mkdir()
        (self.repo/'branching.md').write_text('private plan')
        self.assertNotIn('untracked.js', pub.package(row, self.repo, False))

    def test_selector_lifecycle_and_escaping(self):
        original = self.previous()
        self.row['label'] = '<script>alert(1)</script>'
        self.row['description'] = '<img onerror="evil">'
        self.row['state'] = 'archived'
        output = self.build(previous=original)
        page = output['index.html'].decode()
        self.assertIn('<details>', page)
        self.assertIn('&lt;script&gt;', page)
        self.assertNotIn('<script>alert', page)
        self.assertIn('Tracking off', page)
        self.row['state'] = 'hidden'
        output = self.build(previous=original)
        self.assertNotIn('versions/v1', output['index.html'].decode())
        self.assertEqual(output['versions/v1/index.html'], self.build()['versions/v1/index.html'])
        self.row['state'] = 'retired'
        retired = self.build(previous=original)
        self.assertIn(b'This build has been retired', retired['versions/v1/index.html'])
        self.assertNotIn('versions/v1/assets/a.png', retired)
        self.row['state'] = 'active'
        restored = self.build(previous=json.loads(retired['publication-manifest.json']))
        self.assertEqual(restored['versions/v1/index.html'], pub.export(self.sha, 'versions/v1', self.repo)['index.html'])

    def test_legacy_tracking_badge_cannot_disagree_with_source(self):
        self.row['tracking'] = True
        with self.assertRaisesRegex(ValueError, 'tracking metadata'):
            self.build()


    def test_missing_and_moved_tags(self):
        self.git('tag', '-d', 'snapshot/v1')
        with self.assertRaises(subprocess.CalledProcessError): self.build()
        self.git('commit', '--allow-empty', '-m', 'later')
        self.git('tag', 'snapshot/v1', 'HEAD')
        with self.assertRaisesRegex(ValueError, 'moved'): self.build()
        with self.assertRaisesRegex(ValueError, 'moved'): self.build(require_tags=False)

    def test_immutable_and_missing_builds(self):
        original = self.previous()
        for key, value in [('tracking', True), ('digest', 'f'*64), ('commit', 'f'*40)]:
            old = self.row[key]
            self.row[key] = value
            with self.assertRaisesRegex(ValueError, 'immutable|migration baseline'): self.build(previous=original)
            self.row[key] = old
        second = dict(self.row, id='other', source_tag='snapshot/other', public_path='versions/other/index.html', source_dir='versions/other')
        self.catalog['snapshots'] = [second]
        with self.assertRaisesRegex(ValueError, 'missing retained'): self.build(previous=original)

    def test_bad_metadata(self):
        for key, value in [('id', '../escape'), ('public_path', '../index.html'), ('tracking', 'false'), ('order', True), ('format', 'future'), ('state', 'deleted'), ('ongoing_study', 'no'), ('digest', 'abc'), ('source_dir', 'app/../../.git')]:
            bad = copy.deepcopy(self.catalog)
            bad['snapshots'][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): pub.validate(bad)
        self.catalog['snapshots'].append(dict(self.row))
        with self.assertRaisesRegex(ValueError, 'duplicate'): pub.validate(self.catalog)
        with self.assertRaisesRegex(ValueError, 'duplicate JSON'): pub.read_json('{"x":1,"x":2}')

    def test_studies_must_be_resolved(self):
        original = self.previous()
        for state in ('archived', 'hidden', 'retired'):
            for study in (True, None):
                self.row.update(state=state, ongoing_study=study)
                with self.subTest(state=state, study=study), self.assertRaisesRegex(ValueError, 'resolve study'):
                    self.build(previous=original)

    def test_size_digest_and_corrupt_manifest(self):
        with self.assertRaisesRegex(ValueError, 'size ceiling'): self.build(ceiling=1)
        original = self.previous()
        original['snapshots']['v1']['assets/a.png'] = 'f'*64
        with self.assertRaisesRegex(ValueError, 'previous snapshot digest'): self.build(previous=original)
        self.row['digest'] = 'f'*64
        with self.assertRaisesRegex(ValueError, 'digest mismatch'): self.build()

    def test_stale_publication(self):
        self.git('commit', '--allow-empty', '-m', 'new catalog')
        newer = self.git('rev-parse', 'HEAD')
        previous = json.loads(self.build(revision=newer)['publication-manifest.json'])
        with self.assertRaisesRegex(ValueError, 'stale'): self.build(previous=previous)
        self.assertTrue(self.build(revision=newer, previous=previous))

    def test_selector_order_and_tracking_independent(self):
        rows = self.catalog['snapshots']
        rows.extend([dict(self.row, id='second', source_tag='snapshot/second', source_dir='versions/second', public_path='versions/second/index.html', label='Second', order=3, tracking=True), dict(self.row, id='first', source_tag='snapshot/first', source_dir='versions/first', public_path='versions/first/index.html', label='First', order=1)])
        page = pub.selector(self.catalog, '<!-- CATALOG -->', b'', b'')['index.html'].decode()
        self.assertLess(page.index('One'), page.index('First'))
        self.assertLess(page.index('First'), page.index('Second'))
        self.assertIn('Tracking on', page)

    def test_missing_new_asset_fails(self):
        with self.assertRaisesRegex(ValueError, 'missing published asset'):
            pub.validate_assets({'index.html': b'<img src="missing.png">'}, [])
        pub.validate_assets({'index.html': b'<img src="asset.png">', 'asset.png': b'png'}, [])

    def test_cli_bootstrap_and_atomic_output(self):
        scripts = self.repo/'scripts'; scripts.mkdir()
        (scripts/'publish.py').write_bytes(Path(pub.__file__).read_bytes())
        (self.repo/'publication').mkdir()
        (self.repo/'publication/catalog.json').write_text(json.dumps(self.catalog))
        for path, data in self.assets.items():
            dest = self.repo/path; dest.parent.mkdir(parents=True, exist_ok=True); dest.write_bytes(data)
        self.git('add', 'scripts', 'publication', 'index.html', 'gate')
        self.git('commit', '-m', 'catalog')
        self.git('tag', 'publish/first')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        def run(*extra):
            return subprocess.run(['python3', str(scripts/'publish.py'), 'build', '--revision', 'refs/tags/publish/first', '--output', str(self.repo/'out'), *extra], cwd=self.repo, capture_output=True, text=True)
        self.assertNotEqual(run().returncode, 0)
        self.assertFalse((self.repo/'out').exists())
        self.assertNotEqual(run('--bootstrap-baseline', self.sha, '--bootstrap-tag', 'refs/tags/publish/wrong').returncode, 0)
        result = run('--bootstrap-baseline', self.sha, '--bootstrap-tag', 'refs/tags/publish/first')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.repo/'out/publication-manifest.json').is_file())
        self.assertNotEqual(run('--offline').returncode, 0)  # Never overwrite an output tree.
        # Missing live manifest on subsequent publications still cannot bootstrap.
        self.git('commit', '--allow-empty', '-m', 'later')
        self.git('update-ref', 'refs/remotes/origin/main', 'HEAD')
        result = run('--bootstrap-baseline', self.sha, '--bootstrap-tag', 'refs/tags/publish/first')
        self.assertIn('stale publication', result.stderr)


    def test_symlink_rejected_without_reading_target(self):
        (self.repo/'versions/v1/link').symlink_to('/etc/passwd')
        self.git('add', 'versions/v1/link')
        self.git('commit', '-m', 'link')
        with self.assertRaisesRegex(ValueError, 'links/submodules'):
            pub.export(self.git('rev-parse', 'HEAD'), 'versions/v1', self.repo)


if __name__ == '__main__':
    unittest.main()
