"""An installed TFT (Unreal) client: its non-encrypted IoStore containers plus
helpers to resolve "/Plugin/Path/Asset" package paths and load curve tables."""

import os
import re

from iostore import Container, EncryptedContainerError
from uasset import Package, parse_curve_table


class Game:
    def __init__(self, install, oodle):
        paks = os.path.join(install, 'TFT', 'Content', 'Paks')
        self.containers = []
        self.where = {}
        for name in sorted(os.listdir(paks)):
            if not name.endswith('.utoc') or name == 'global.utoc':
                continue
            try:
                c = Container(os.path.join(paks, name[:-5]), oodle)
            except EncryptedContainerError:
                print(f'  skipping encrypted container {name}')
                continue
            self.containers.append(c)
            for path in c.paths:
                self.where.setdefault(path, c)
        # "/Set_18/…" → "TFT/Plugins/GameFeatures/Set_18/Content/…"
        self.mounts = {'/Game/': 'TFT/Content/'}
        for path in self.where:
            m = re.match(r'^(TFT/Plugins/(?:.+/)?([^/]+)/Content/)', path)
            if m:
                self.mounts.setdefault(f'/{m.group(2)}/', m.group(1))
        self._tables = {}

    def file_for(self, package_path, ext='.uasset'):
        m = re.match(r'^(/[^/]+/)(.*)$', package_path or '')
        if not m or m.group(1) not in self.mounts:
            return None
        path = self.mounts[m.group(1)] + m.group(2) + ext
        return path if path in self.where else None

    def to_package_path(self, file_path):
        for mount, prefix in self.mounts.items():
            if file_path.startswith(prefix):
                return mount + file_path[len(prefix):-len('.uasset')]
        return None

    def read(self, path):
        return self.where[path].read(path)

    def package(self, package_path):
        path = self.file_for(package_path)
        return Package(self.read(path)) if path else None

    def curve_table(self, package_path):
        if package_path not in self._tables:
            pkg = self.package(package_path)
            self._tables[package_path] = parse_curve_table(pkg.export_data(pkg.exports[0]), pkg) if pkg else None
        return self._tables[package_path]

    def curve(self, package_path, row):
        rows = self.curve_table(package_path)
        return rows.get(row) if rows else None
