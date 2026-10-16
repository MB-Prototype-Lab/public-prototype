#!/usr/bin/env python3
"""Actions-only preparation; stops on network or manifest failures."""
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import publish

ref = os.environ['PUBLICATION_REF']
publish.require(ref.startswith('refs/tags/publish/'), 'not a publication ref')
subprocess.run(['git', 'fetch', 'origin', 'main', '--tags'], check=True)
publish.require(publish.git('rev-parse', ref+'^{commit}') == publish.git('rev-parse', 'HEAD'), 'publication tag no longer matches checked-out revision')
# This URL deliberately stays fixed: do not accept a manifest from an arbitrary input.
url = 'https://mb-prototype-lab.github.io/public-prototype/publication-manifest.json'
try:
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=30) as response:
        previous = response.read(20_000_001)
    publish.require(len(previous) <= 20_000_000, 'manifest too large')
    manifest = publish.read_json(previous)
    publish.validate_manifest(manifest)
    # Bind the live identity to its committed reviewed catalog, not just arbitrary JSON.
    committed = publish.read_json(publish.git('show', manifest['revision']+':publication/catalog.json'))
    publish.require(committed == manifest['catalog'], 'live manifest catalog differs from Git')
except urllib.error.HTTPError as exc:
    raise SystemExit('Cannot retrieve previous manifest; deployment stopped') from exc

path = Path(os.environ['RUNNER_TEMP'])/'previous-publication.json'
path.write_bytes(previous)
command = ['python3', 'scripts/publish.py', 'build', '--revision', ref, '--output', 'publication-output',
           '--previous', str(path)]
subprocess.run(command, check=True)
