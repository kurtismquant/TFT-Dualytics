"""Read-only access to the Unreal IoStore containers (.utoc/.ucas) of the local
TFT client (Set 18+ runs on Unreal Engine 5; the League-side game files that
CommunityDragon exports only carry placeholder unit spells since then).

Riot ships the IoStore containers unencrypted (container flags Compressed |
Indexed, all-zero key GUID). A container that sets the Encrypted flag is
refused outright: this tool never handles keys. The legacy .pak files next to
the containers have encrypted indexes and are never opened.

Most blocks are Oodle-compressed. Oodle is proprietary, so decompression goes
through oodle-data-shared.dll — the build of Unreal's Oodle source that
CUE4Parse/FModel load (WorkingRobot/OodleUE release 2026-06-04-1357,
clang-cl-x64-release.zip, bin/oodle-data-shared.dll). It's unsigned, so it is
only loaded when its SHA-256 matches the pinned hash below.
"""

import ctypes
import functools
import hashlib
import os
import struct

OODLE_DLL_NAME = 'oodle-data-shared.dll'
OODLE_SHA256 = 'cba19529d0a3b5ec9c630e95652af01e123ae29a34a8a5f7507f5bcf23d9e82b'

TOC_MAGIC = b'-==--==--==--==-'
FLAG_ENCRYPTED = 0x02
FLAG_INDEXED = 0x08
# Layout below (perfect-hash seeds, chunks-without-perfect-hash count) exists
# from TOC version 5; version 8 is UE 5.6/5.7. Refuse anything newer rather
# than misread it.
SUPPORTED_TOC_VERSIONS = range(5, 9)
TOC_HEADER_SIZE = 144
NO_ENTRY = 0xFFFFFFFF


class EncryptedContainerError(Exception):
    pass


class NeedsOodleError(Exception):
    pass


class Oodle:
    def __init__(self, dll_path):
        with open(dll_path, 'rb') as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        if digest != OODLE_SHA256:
            raise RuntimeError(
                f'{dll_path} has SHA-256 {digest}, expected the pinned {OODLE_SHA256}. '
                'Refusing to load an unverified DLL.'
            )
        lib = ctypes.CDLL(os.path.abspath(dll_path))
        fn = lib.OodleLZ_Decompress
        # OO_SINTa OodleLZ_Decompress(const void* comp, OO_SINTa compLen, void* raw,
        #   OO_SINTa rawLen, fuzzSafe, checkCRC, verbosity, void* decBufBase,
        #   OO_SINTa decBufSize, callback, callbackUserData, void* decoderMemory,
        #   OO_SINTa decoderMemorySize, threadPhase)
        fn.restype = ctypes.c_ssize_t
        fn.argtypes = [
            ctypes.c_char_p, ctypes.c_ssize_t, ctypes.c_void_p, ctypes.c_ssize_t,
            ctypes.c_int, ctypes.c_int, ctypes.c_int,
            ctypes.c_void_p, ctypes.c_ssize_t, ctypes.c_void_p, ctypes.c_void_p,
            ctypes.c_void_p, ctypes.c_ssize_t, ctypes.c_int,
        ]
        self._decompress = fn

    def decompress(self, comp, raw_len):
        out = ctypes.create_string_buffer(raw_len)
        # fuzzSafe=1, checkCRC=0, verbosity=0, threadPhase=3 (all phases)
        n = self._decompress(comp, len(comp), out, raw_len, 1, 0, 0, None, 0, None, None, None, 0, 3)
        if n != raw_len:
            raise ValueError(f'Oodle decompressed {n} bytes, expected {raw_len}')
        return out.raw


class Container:
    """One IoStore container: `base` is the path without .utoc/.ucas."""

    def __init__(self, base, oodle=None):
        with open(base + '.utoc', 'rb') as f:
            toc = f.read()
        if toc[:16] != TOC_MAGIC:
            raise ValueError(f'{base}.utoc is not an IoStore TOC')
        u32 = lambda o: struct.unpack_from('<I', toc, o)[0]
        version = toc[16]
        if version not in SUPPORTED_TOC_VERSIONS:
            raise ValueError(f'{base}.utoc: TOC version {version} is not supported')
        flags = toc[80]
        if flags & FLAG_ENCRYPTED:
            raise EncryptedContainerError(f'{base}.utoc is encrypted; refusing to read it')
        header_size, entries, blocks, block_entry_size = u32(20), u32(24), u32(28), u32(32)
        method_count, method_len, self.block_size, dir_size = u32(36), u32(40), u32(44), u32(48)
        partition_count, seeds, no_hash = u32(52), u32(84), u32(96)
        self.partition_size = struct.unpack_from('<Q', toc, 88)[0]
        if header_size != TOC_HEADER_SIZE or block_entry_size != 12:
            raise ValueError(f'{base}.utoc: unexpected TOC layout')

        o = header_size
        self._chunk_ids_at = o
        o += entries * 12
        self._offsets_at = o
        o += entries * 10
        o += seeds * 4 + no_hash * 4
        self._blocks_at = o
        o += blocks * block_entry_size
        # Method index 0 means "stored"; names cover indices 1..N.
        self.methods = [
            toc[o + i * method_len: o + (i + 1) * method_len].rstrip(b'\0').decode('ascii')
            for i in range(method_count)
        ]
        o += method_count * method_len
        self._toc = toc
        self.paths = self._read_directory_index(o, dir_size) if flags & FLAG_INDEXED else {}

        self._ucas = [open(base + '.ucas', 'rb')]
        for i in range(1, max(partition_count, 1)):
            self._ucas.append(open(f'{base}_s{i}.ucas', 'rb'))
        self.oodle = oodle

    def _read_directory_index(self, start, size):
        toc, p = self._toc, start

        def fstring():
            nonlocal p
            n = struct.unpack_from('<i', toc, p)[0]
            p += 4
            if n == 0:
                return ''
            if n > 0:
                s = toc[p:p + n - 1].decode('latin1')
                p += n
                return s
            s = toc[p:p + (-n - 1) * 2].decode('utf-16le')
            p += -n * 2
            return s

        mount = fstring()
        count = struct.unpack_from('<i', toc, p)[0]
        p += 4
        dirs = [struct.unpack_from('<4I', toc, p + i * 16) for i in range(count)]  # name, firstChild, nextSibling, firstFile
        p += count * 16
        count = struct.unpack_from('<i', toc, p)[0]
        p += 4
        files = [struct.unpack_from('<3I', toc, p + i * 12) for i in range(count)]  # name, nextFile, tocIndex
        p += count * 12
        count = struct.unpack_from('<i', toc, p)[0]
        p += 4
        names = [fstring() for _ in range(count)]
        if p - start != size:
            raise ValueError('directory index size mismatch')

        # Mount point is "../../../"; paths are kept relative to it ("TFT/Plugins/...").
        prefix_root = mount.replace('../', '')
        paths = {}
        stack = [(0, prefix_root)] if dirs else []
        while stack:
            di, prefix = stack.pop()
            name, child, _, f = dirs[di]
            path = prefix if name == NO_ENTRY else f'{prefix}{names[name]}/'
            while f != NO_ENTRY:
                paths[path + names[files[f][0]]] = files[f][2]
                f = files[f][1]
            while child != NO_ENTRY:
                stack.append((child, path))
                child = dirs[child][2]
        return paths

    def read(self, path):
        return self.read_entry(self.paths[path])

    def read_entry(self, index):
        raw = self._toc[self._offsets_at + index * 10: self._offsets_at + index * 10 + 10]
        offset = int.from_bytes(raw[:5], 'big')
        length = int.from_bytes(raw[5:], 'big')
        first, last = offset // self.block_size, (offset + length - 1) // self.block_size
        data = b''.join(self._block(i) for i in range(first, last + 1))
        start = offset % self.block_size
        return data[start:start + length]

    @functools.lru_cache(maxsize=256)
    def _block(self, index):
        e = self._toc[self._blocks_at + index * 12: self._blocks_at + index * 12 + 12]
        offset = int.from_bytes(e[:5], 'little')
        comp_size = int.from_bytes(e[5:8], 'little')
        raw_size = int.from_bytes(e[8:11], 'little')
        method = e[11]
        part = offset // self.partition_size if len(self._ucas) > 1 else 0
        f = self._ucas[part]
        f.seek(offset - part * self.partition_size if part else offset)
        if method == 0:
            return f.read(raw_size)
        name = self.methods[method - 1]
        if name != 'Oodle':
            raise ValueError(f'unsupported compression method {name}')
        if self.oodle is None:
            raise NeedsOodleError('block is Oodle-compressed and no Oodle DLL was given')
        return self.oodle.decompress(f.read(comp_size), raw_size)

    def close(self):
        for f in self._ucas:
            f.close()
