#!/usr/bin/env python3
"""Actions-only preparation; stops on network or manifest failures."""
import argparse
import os
import re
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import publish

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--fetched-origin-main', metavar='SHA',
                    help='Use origin/main already fetched by the authenticated CI host')
args = parser.parse_args()
ref = os.environ['PUBLICATION_REF']
publish.require(ref.startswith('refs/tags/publish/'), 'not a publication ref')
if args.fetched_origin_main is None:
    subprocess.run(['git', 'fetch', 'origin', 'main', '--tags'], check=True)
else:
    expected = args.fetched_origin_main
    publish.require(re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', expected) is not None,
                    'fetched origin/main must be a full commit SHA')
    publish.require(publish.git('rev-parse', 'refs/remotes/origin/main^{commit}').decode().strip() == expected,
                    'bundled origin/main differs from the authenticated host fetch')
    publish.require(publish.git('rev-parse', 'HEAD').decode().strip() == expected,
                    'publication is not at the freshly fetched main')
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
