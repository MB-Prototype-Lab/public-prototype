"""Flow publication identity and lifecycle regression checks."""
import copy
import json
import re
import shutil
import subprocess
from pathlib import Path
import unittest
try:
    import test_publication as legacy  # discover -s tests
except ModuleNotFoundError:
    from tests import test_publication as legacy  # python3 -m unittest tests.test_flow_publication
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
        def panels(page):
            flows=page.index('id="gatePanelFlows"')
            return page[page.index('id="gatePanelPrototype"'):flows],page[flows:]
        app,flows=panels(self.build()['index.html'].decode())
        self.assertIn('<a class="gate-row" href="versions/fund-study/index.html">',flows)
        self.assertNotIn('versions/fund-study',app)
        self.assertNotIn('versions/v1',flows)
        self.flow['state']='archived'
        app,flows=panels(self.build(previous=previous)['index.html'].decode())
        older=flows[flows.index('<details class="gate-older"><summary>Older versions</summary>'):]
        self.assertIn('versions/fund-study/index.html',older)
        self.assertNotIn('versions/fund-study',app)
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
        with self.assertRaisesRegex(ValueError,r'^flow\.json \(emergency-fund\): unsafe or mismatched Flow ID$'): pub.package(row,self.repo,False)
        package=self.repo/'flows/emergency-fund'
        (package/'flow.json').write_bytes(json.dumps(self.metadata).encode()+b'\n')
        (package/'flow-config.js').unlink()
        self.git('add','flows')
        self.git('commit','-m','policy wrapper deleted')
        row=dict(self.flow,id='absent',source_tag='snapshot/absent',commit=self.git('rev-parse','HEAD'),public_path='versions/absent/index.html')
        with self.assertRaisesRegex(ValueError,'^Flow policy wrapper differs from metadata$'): pub.package(row,self.repo,False)

    def test_flow_dependency_rejections(self):
        for value,guard in (('missing.png','missing dependency'),('../../../app/index.html','traversal dependency'),
                            ('/app/index.html','forbidden dependency'),('../../index.html','traversal dependency')):
            with self.subTest(value=value):
                row=self.changed('index.html',('<script src="release-config.js"></script><script src="flow-config.js"></script><script src="js/config.js"></script><script src="js/flow.js"></script><script src="js/navigation.js"></script><img src="'+value+'">').encode())
                with self.assertRaisesRegex(ValueError,r'/index\.html: '+guard+' '+re.escape(repr(value))+'$'): pub.package(row,self.repo,False)

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

    def test_flow_policy_wrapper_scripts_and_escaping_anchor(self):
        scripts=b'<script src="release-config.js"></script><script src="flow-config.js"></script><script src="js/config.js"></script><script src="js/flow.js"></script><script src="js/navigation.js"></script>'
        for path,data,message in [('flow.json',b'{','^Expecting property name enclosed in double quotes'),
                                  ('flow-config.js',b'window.MB_FLOW={};','^Flow policy wrapper differs from metadata$'),
                                  # Missing runtime scripts stop packaging before any dependency is read.
                                  ('index.html',b'<script src="release-config.js"></script><script src="flow-config.js"></script><a href="../../../app/index.html">Escape</a>',
                                   '^Flow entry missing required policy/runtime scripts$'),
                                  # Only the anchor check sees an escape with no file extension.
                                  ('index.html',scripts+b'<a href="../../../app/">Escape</a>',r"/index\.html: traversal dependency '\.\./\.\./\.\./app/'$")]:
            with self.subTest(path=path,data=data):
                # Restore valid committed metadata between negative fixtures.
                package=self.repo/'flows/emergency-fund'
                (package/'flow.json').write_bytes(json.dumps(self.metadata).encode()+b'\n')
                (package/'flow-config.js').write_bytes(self.wrapper())
                row=self.changed(path,data)
                with self.assertRaisesRegex(ValueError,message): pub.package(row,self.repo,False)

    def test_frozen_tracking_resists_participant_urls(self):
        node=shutil.which('node')
        if not node: self.skipTest('Node unavailable')
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
                 '--label','Fund study','--tracking','off','--main-ref','main']
        result=subprocess.run(command,cwd=self.repo.parent,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        prepared=json.loads(result.stdout)
        self.assertIsNone(prepared['ongoing_study'])
        self.assertEqual(prepared['order'],0)
        self.assertEqual(prepared['source_dir'],'flows/emergency-fund')
        self.assertEqual(prepared['format'],'flow-static-v1')
        self.assertEqual(prepared['digest'],self.flow['digest'])
        default_ref=subprocess.run(command[:-2],cwd=self.repo.parent,capture_output=True,text=True)
        self.assertNotEqual(default_ref.returncode,0)
        self.assertIn('snapshot source must be on main ref: refs/remotes/origin/main',default_ref.stderr)
        command[command.index('emergency-fund')]='../app'
        self.assertNotEqual(subprocess.run(command,cwd=self.repo,capture_output=True).returncode,0)

    def test_final_inventory_and_dynamic_dependencies(self):
        original=pub.export(self.flow['commit'],self.flow['source_dir'],self.repo)['index.html']
        for extra,message in ((b'<link rel="stylesheet" href="../../index.html">',"traversal dependency '../../index.html'"),
                              (b'<img src="flow.json">',"missing dependency 'flow.json'"),
                              (b'<script src="docs/author.json"></script>',"missing dependency 'docs/author.json'")):
            with self.subTest(extra=extra):
                row=self.changed('index.html',original+extra)
                with self.assertRaisesRegex(ValueError,r'/index\.html: '+re.escape(message)+'$'): pub.package(row,self.repo,False)
        (self.repo/'flows/emergency-fund/index.html').write_bytes(original)
        row=self.changed('js/flow.js',b'const media = "assets/missing/" + theme + ".mp4";')
        with self.assertRaisesRegex(ValueError,r"/js/flow\.js: missing dependency 'assets/missing'$"): pub.package(row,self.repo,False)

    def test_policy_script_order(self):
        original=pub.export(self.flow['commit'],self.flow['source_dir'],self.repo)['index.html']
        row=self.changed('index.html',original.replace(b'<script src="flow-config.js"></script>',b'') + b'<script src="flow-config.js"></script>')
        with self.assertRaisesRegex(ValueError,'script order'): pub.package(row,self.repo,False)

    def test_flow_source_shape_rejected(self):
        for source,message in (('flows/../app','unsafe source directory'),('flows/Upper','invalid Flow source directory'),
                               ('flows/a/b','invalid Flow source directory'),('app','invalid Flow source directory')):
            catalog=copy.deepcopy(self.catalog)
            catalog['snapshots'][-1]['source_dir']=source
            with self.subTest(source=source), self.assertRaisesRegex(ValueError,'^'+message+'$'): pub.validate(catalog)


if __name__=='__main__':
    unittest.main()
