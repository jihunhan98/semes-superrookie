#!/usr/bin/env python3
"""Build a single offline HTML with pinned official AUI assets (Python stdlib only)."""
from pathlib import Path
import argparse
import base64
import hashlib
import re
import urllib.request

ROOT = Path(__file__).resolve().parent
AUI = 'https://unpkg.com/@atlassian/aui@9.12.0/'
ASSETS = {
    'aui.css': (AUI + 'dist/aui/aui-prototyping.css', '7dc34591fb0373c68e3597988813c979d1c3cc2284644a7166cc3c9125b55cc2'),
    'aui.js': (AUI + 'dist/aui/aui-prototyping.js', 'aeb3559e7e449427d83da81725b92e6b55d0c8ce49c4c3b6992a51f14bc39876'),
    'jquery.js': ('https://unpkg.com/jquery@3.7.1/dist/jquery.min.js', 'fc9a93dd241f6b045cbff0481cf4e1901becd0e12fb45166a8f17f95823f0b1a'),
    'atlassian-icons.woff': (AUI + 'dist/aui/fonts/atlassian-icons.woff', 'bed6dc4a7cd389e609a668bdd518ac1659f143ccb253d81a56faaca121923530'),
    'adgs-icons.woff': (AUI + 'dist/aui/fonts/adgs-icons.woff', 'd96e135eef02ae8baa53ec80c5b39742fefe7260b00714c0f10bb8b371623daa'),
}


def build(asset_dir):
    asset_dir.mkdir(parents=True, exist_ok=True)
    assets = {}
    for name, (url, expected) in ASSETS.items():
        cache = asset_dir / name
        data = cache.read_bytes() if cache.exists() else urllib.request.urlopen(url, timeout=30).read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'Asset checksum mismatch: {name}')
        cache.write_bytes(data)
        assets[name] = data

    css = assets['aui.css'].decode('utf-8')
    # Keep the official font-face rules and substitute their sources with embedded WOFF.
    # The obsolete EOT/TTF/SVG alternatives are removed; no relative font URLs remain.
    def embed_font(match):
        rule = match.group(0)
        for name in ('atlassian-icons', 'adgs-icons'):
            if f'fonts/{name}.' in rule:
                data = base64.b64encode(assets[name + '.woff']).decode('ascii')
                rule = re.sub(r'src:[^;}]*(?:;|(?=}))', '', rule)
                return rule[:-1] + f'src:url(data:font/woff;base64,{data}) format("woff");' + '}'
        return rule

    css = re.sub(r'@font-face\s*\{[^}]*\}', embed_font, css)
    css = re.sub(r'/\*# sourceMappingURL=.*?\*/', '', css)
    if re.search(r'url\(["\']?(?:fonts/|images/)', css):
        raise ValueError('External AUI font/image reference remains')

    template = (ROOT / 'jira-10.3.21-preview.template.html').read_text(encoding='utf-8')
    for placeholder, asset in [('/* AUI_CSS */', css), ('/* JQUERY_JS */', assets['jquery.js'].decode()), ('/* AUI_JS */', assets['aui.js'].decode())]:
        if 'JS' in placeholder:
            asset = re.sub(r'(?im)^//# sourceMappingURL=.*$', '', asset)
            asset = re.sub(r'</script', r'<\\/script', asset, flags=re.I)
        template = template.replace(placeholder, asset)
    notices = (ROOT / 'jira-10.3.21-preview-LICENSE.txt').read_text(encoding='utf-8')
    template = template.replace('<!-- THIRD_PARTY_NOTICES -->', '<!-- Third-party notices\n' + notices.replace('--', '- -') + '\n-->')
    output = ROOT / 'jira-10.3.21-issue-preview.html'
    output.write_text(template, encoding='utf-8')
    print(f'Built {output.name}: {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--asset-dir', type=Path, default=ROOT / '.jira-preview-assets', help='Cached official assets; download only when missing')
    build(parser.parse_args().asset_dir)
