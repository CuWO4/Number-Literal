#!/usr/bin/env python3
"""Build <name>-<version>.vsix from the sources in this folder.

A vsix is a zip holding [Content_Types].xml, extension.vsixmanifest and the
extension files under extension/.

Install the result with the CLI that ships with the server, then reload the
window:

    python3 pack.py
    ~/.vscode-server/bin/<commit>/bin/remote-cli/code \
        --install-extension ./number-literal-0.1.0.vsix --force

Do not install by copying the folder into the extensions dir: VS Code records an
uninstalled extension in <extensions dir>/.obsolete and skips (then deletes)
every folder whose id is listed there, so a copied folder silently never loads.
"""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
FILES = [
    'package.json',
    'extension.js',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'doc/sample.gif',
    'lib/scan.js',
    'lib/float.js',
    'lib/format.js'
]

CONTENT_TYPES = '''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".gif" ContentType="image/gif"/>
  <Override PartName="/extension/LICENSE" ContentType="text/plain"/>
</Types>
'''

MANIFEST = '''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{name}" Version="{version}" Publisher="{publisher}" />
    <DisplayName>{display}</DisplayName>
    <Description xml:space="preserve">{description}</Description>
    <Tags>number,hover,converter</Tags>
    <Categories>Other</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{engine}" />
      <Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  </Assets>
</PackageManifest>
'''


def main():
    with open(os.path.join(ROOT, 'package.json')) as handle:
        pkg = json.load(handle)
    out = os.path.join(ROOT, '%s-%s.vsix' % (pkg['name'], pkg['version']))
    manifest = MANIFEST.format(
        name=pkg['name'],
        version=pkg['version'],
        publisher=pkg['publisher'],
        display=pkg.get('displayName', pkg['name']),
        description=pkg.get('description', ''),
        engine=pkg['engines']['vscode']
    )
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', CONTENT_TYPES)
        archive.writestr('extension.vsixmanifest', manifest)
        for rel in FILES:
            archive.write(os.path.join(ROOT, rel), 'extension/' + rel)
    print(out)


if __name__ == '__main__':
    main()
