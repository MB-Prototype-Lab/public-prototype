"""Flow publication identity and lifecycle regression checks."""
import copy
import json
import shutil
import subprocess
from pathlib import Path
import unittest
import test_publication as legacy
pub = legacy.pub


class FlowPublicationTests(unittest.TestCase):
    git = legacy.PublicationTests.git
    build = legacy.PublicationTests.build
    previous = legacy.PublicationTests.previous
    def setUp(self):
        legacy.PublicationTests.setUp(self)
        package = self.repo/'flows/emergency-fund'
        package.mkdir(parents=True)
        self.metadata = dict(schema=1, id='emergency-fund', label='Emergency fund',
            purpose='Contained fund', reference=None, source_app_commit=self.sha,
            task_base=self.sha, entry='onboarding', completion='goals',
            allowed_screens=['onboarding', 'goals'], setup_steps=['zip'],
            profile_behavior='Use existing defaults', proposed_differences=[])
        (package/'flow.json').write_bytes(json.dumps(self.metadata).encode()+b'\n')
        (package/'flow-config.js').write_bytes(self.wrapper())
        (package/'release-config.js').write_text('window.MB_RELEASE={tracking:false};')
        (package/'index.html').write_text('<script src="release-config.js"></script><script src="flow-config.js"></script><img src="assets/a.png"><a href="../../index.html">Exit</a>')
        (package/'js').mkdir()
        for name in ('config.js','flow.js','navigation.js'):
            (package/'js'/name).write_text('// runtime fixture')
        (package/'index.html').write_text((package/'index.html').read_text() + '<script src="js/config.js"></script><script src="js/flow.js"></script><script src="js/navigation.js"></script>')
        (package/'assets').mkdir()
        (package/'assets/a.png').write_bytes(b'PNG')
        (package/'docs').mkdir()
        (package/'docs/author.json').write_text('{}')
        (package/'nested').mkdir()
        (package/'nested/alternate.html').write_text('<h1>Alternate entry</h1>')
        self.git('add', 'flows')
        self.git('commit', '-m', 'flow')
        self.flow = dict(self.row, id='fund-study', source_tag='snapshot/fund-study',
            commit=self.git('rev-parse','HEAD'), source_dir='flows/emergency-fund',
            public_path='versions/fund-study/index.html', format='flow-static-v1')
        self.flow['digest'] = pub.digest(pub.package(self.flow, self.repo, False))
        self.git('tag','snapshot/fund-study')
        self.catalog['snapshots'].append(self.flow)
        self.sha = self.git('rev-parse','HEAD')

    def wrapper(self):
        return pub.flow_tools().wrapper('MB_FLOW', self.metadata).encode()

    def changed(self, path, data):
        (self.repo/'flows/emergency-fund'/path).write_bytes(data)
        self.git('add','flows')
        self.git('commit','-m','fixture change')
        return dict(self.flow, id='changed', source_tag='snapshot/changed', commit=self.git('rev-parse','HEAD'), public_path='versions/changed/index.html')

    def test_flow_package_committed_only_and_frozen(self):
        (self.repo/'flows/emergency-fund/untracked.js').write_text('untracked')
        files = pub.package(self.flow,self.repo)
        self.assertNotIn('flow.json',files)
        self.assertNotIn('docs/author.json',files)
        self.assertNotIn('untracked.js',files)
        self.assertIn('flow-config.js',files)
        self.assertIn(b'"tracking":false',files['release-config.js'])
        self.assertIn(b'"selector":"../../index.html"',files['release-config.js'])
        self.assertEqual(pub.package(self.row,self.repo),pub.export(self.row['commit'],self.row['source_dir'],self.repo))
        self.assertNotIn('flow-config.js',pub.package(dict(self.flow,format='static-v1',source_dir='app'),self.repo))

    def test_flow_discovery_hidden_retirement_and_restore(self):
        previous=self.previous()
        self.assertIn('Flow snapshots',self.build()['index.html'].decode())
        self.flow['state']='archived'
        self.assertIn('Older Flow snapshots',self.build(previous=previous)['index.html'].decode())
        self.flow['state']='hidden'
        hidden=self.build(previous=previous)
        self.assertNotIn('versions/fund-study',hidden['index.html'].decode())
        self.assertIn('versions/fund-study/nested/alternate.html',hidden)
        self.flow['state']='retired'
        retired=self.build(previous=previous)
        self.assertEqual([p for p in retired if p.startswith('versions/fund-study/')],['versions/fund-study/index.html'])
        self.flow['state']='active'
        self.assertEqual(self.build(previous=json.loads(retired['publication-manifest.json']))['versions/fund-study/index.html'],hidden['versions/fund-study/index.html'])

    def test_flow_metadata_mismatch_and_absent_wrapper(self):
        row=self.changed('flow.json',pub.canonical(dict(self.metadata,id='different')))
        with self.assertRaises(ValueError): pub.package(row,self.repo,False)

    def test_flow_dependency_rejections(self):
        for value in ('missing.png','../../../app/index.html','/app/index.html','../../index.html'):
            with self.subTest(value=value):
                row=self.changed('index.html',('<script src="release-config.js"></script><script src="flow-config.js"></script><script src="js/config.js"></script><script src="js/flow.js"></script><script src="js/navigation.js"></script><img src="'+value+'">').encode())
                with self.assertRaises(ValueError): pub.package(row,self.repo,False)

    def test_flow_identity_tags_digest_manifest_and_ceiling(self):
        previous=self.previous()
        self.flow['label']='Renamed Flow'
        self.flow['description']='Review <proposal>'
        self.assertIn(b'Review &lt;proposal&gt;',self.build(previous=previous)['index.html'])
        self.assertEqual(self.build(previous=previous)['versions/fund-study/index.html'],pub.package(self.flow,self.repo)['index.html'])
        with self.assertRaisesRegex(ValueError,'size ceiling'): self.build(ceiling=1)
        original=self.flow['digest']
        self.flow['digest']='f'*64
        with self.assertRaisesRegex(ValueError,'digest mismatch'): self.build()
        with self.assertRaisesRegex(ValueError,'immutable'): self.build(previous=previous)
        self.flow['digest']=original
        previous['snapshots']['fund-study']['index.html']='f'*64
        with self.assertRaisesRegex(ValueError,'previous snapshot digest'): self.build(previous=previous)
        self.git('tag','-d','snapshot/fund-study')
        with self.assertRaises(Exception): self.build()
        self.git('commit','--allow-empty','-m','moved tag fixture')
        self.git('tag','snapshot/fund-study')
        with self.assertRaisesRegex(ValueError,'moved'): self.build(require_tags=False)

    def test_flow_policy_malformed_wrapper_and_missing_asset(self):
        for path,data in [('flow.json',b'{'),('flow-config.js',b'window.MB_FLOW={};'),
                          ('index.html',b'<script src="release-config.js"></script><script src="flow-config.js"></script><a href="../../../app/index.html">Escape</a>')]:
            with self.subTest(path=path):
                # Restore valid committed metadata between negative fixtures.
                package=self.repo/'flows/emergency-fund'
                (package/'flow.json').write_bytes(json.dumps(self.metadata).encode()+b'\n')
                (package/'flow-config.js').write_bytes(self.wrapper())
                row=self.changed(path,data)
                with self.assertRaises(ValueError): pub.package(row,self.repo,False)

    def test_frozen_tracking_resists_participant_urls(self):
        node=shutil.which('node') or '/tmp/node-v22.23.3-linux-arm64/bin/node'
        if not Path(node).exists(): self.skipTest('Node unavailable')
        root=Path(pub.__file__).resolve().parents[1]
        fixture={'config':(root/'app/js/config.js').read_text(),
                 'tracking':(root/'app/js/useberry.js').read_text()}
        for enabled in (True,False):
            release=pub.package(dict(self.flow,tracking=enabled),self.repo)['release-config.js'].decode()
            fixture['release']=release
            script="""const vm=require('vm');const f=JSON.parse(process.argv[1]);
for(const protocol of ['https:','http:','file:']) {
  for(const search of ['?tracking=true&selector=https://example.invalid','?tracking=false&useberry=1','?MB_RELEASE=on']) {
    const c={window:{},location:{protocol,search}};vm.createContext(c);
    vm.runInContext(f.release+f.config+f.tracking,c);
    if(vm.runInContext('useberryActive()',c)!==(ENABLED && protocol!=='file:'))throw Error('tracking changed');
    if(c.window.MB_RELEASE.selector!=='../../index.html'||!Object.isFrozen(c.window.MB_RELEASE))throw Error('release changed');
  }
}
""".replace('ENABLED',str(enabled).lower())
            result=subprocess.run([node,'-e',script,json.dumps(fixture)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)

    def test_prepare_flow_cli_uses_selected_committed_package(self):
        scripts=self.repo/'scripts'
        scripts.mkdir()
        for name in ('publish.py','flows.py'):
            (scripts/name).write_bytes((Path(pub.__file__).parent/name).read_bytes())
        command=['python3',str(scripts/'publish.py'),'prepare','--flow','emergency-fund',
                 '--id','prepared-flow','--commit',self.flow['commit'],
                 '--label','Fund study','--tracking','off']
        result=subprocess.run(command,cwd=self.repo,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        prepared=json.loads(result.stdout)
        self.assertEqual(prepared['source_dir'],'flows/emergency-fund')
        self.assertEqual(prepared['format'],'flow-static-v1')
        self.assertEqual(prepared['digest'],self.flow['digest'])
        command[command.index('emergency-fund')]='../app'
        self.assertNotEqual(subprocess.run(command,cwd=self.repo,capture_output=True).returncode,0)

    def test_final_inventory_and_dynamic_dependencies(self):
        original=pub.export(self.flow['commit'],self.flow['source_dir'],self.repo)['index.html']
        for extra in (b'<link rel="stylesheet" href="../../index.html">',
                      b'<img src="flow.json">', b'<script src="docs/author.json"></script>'):
            with self.subTest(extra=extra):
                row=self.changed('index.html',original+extra)
                with self.assertRaises(ValueError): pub.package(row,self.repo,False)
        (self.repo/'flows/emergency-fund/index.html').write_bytes(original)
        row=self.changed('js/flow.js',b'const media = "assets/missing/" + theme + ".mp4";')
        with self.assertRaises(ValueError): pub.package(row,self.repo,False)

    def test_policy_script_order(self):
        original=pub.export(self.flow['commit'],self.flow['source_dir'],self.repo)['index.html']
        row=self.changed('index.html',original.replace(b'<script src="flow-config.js"></script>',b'') + b'<script src="flow-config.js"></script>')
        with self.assertRaisesRegex(ValueError,'script order'): pub.package(row,self.repo,False)

    def test_flow_source_shape_rejected(self):
        for source in ('flows/../app','flows/Upper','flows/a/b','app'):
            catalog=copy.deepcopy(self.catalog)
            catalog['snapshots'][-1]['source_dir']=source
            with self.assertRaises(ValueError): pub.validate(catalog)


if __name__=='__main__':
    unittest.main()
