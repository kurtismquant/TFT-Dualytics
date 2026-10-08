"""Format tests on synthetic bytes (no game install needed):
  python -I -m unittest discover -s server/scripts/tft_client
"""

import os
import struct
import tempfile
import unittest

from iostore import Container, EncryptedContainerError, TOC_MAGIC
from uasset import (
    FLT_MAX, parse_curve_table, read_ftexts, read_unversioned_header, star_values, texture_mip0,
)


class StubPackage:
    def __init__(self, names):
        self.names = names

    def fname(self, index, number=0):
        return self.names[index]


def header(fragments):
    """fragments: [(skip, values, zero_mask_bits or None)] → header bytes."""
    out, zero_bits = b'', []
    for i, (skip, values, zeros) in enumerate(fragments):
        v = skip | (values << 9)
        if zeros is not None:
            v |= 0x80
            zero_bits += zeros
        if i == len(fragments) - 1:
            v |= 0x100
        out += struct.pack('<H', v)
    if zero_bits:
        mask = sum(1 << i for i, z in enumerate(zero_bits) if z)
        out += mask.to_bytes(1 if len(zero_bits) <= 8 else 2, 'little')
    return out


def simple_curve(interp, keys, zero_interp=False):
    if zero_interp:  # InterpMode flagged zero (RCIM_Linear) → no byte for it
        body = header([(0, 5, [True, False, False, False, False])])
    else:
        body = header([(0, 5, None)]) + bytes([interp])
    body += struct.pack('<i', len(keys)) + b''.join(struct.pack('<ff', t, v) for t, v in keys)
    return body + struct.pack('<f', FLT_MAX) + bytes([4, 4])


def curve_table(mode, rows):
    out = header([(0, 0, None)]) + struct.pack('<ii', 0, len(rows)) + bytes([mode])
    for name_index, curve in rows:
        out += struct.pack('<II', name_index, 0) + curve
    return out


class UnversionedHeaderTest(unittest.TestCase):
    def test_skips_and_zero_mask(self):
        buf = header([(2, 1, None), (3, 2, [False, True])])
        present, end = read_unversioned_header(buf, 0)
        self.assertEqual(present, [(2, False), (6, False), (7, True)])
        self.assertEqual(end, len(buf))


class CurveTableTest(unittest.TestCase):
    def test_simple_curves_evaluate_per_star(self):
        names = ['HexPercentDamageFalloffTooltip', 'AutoAttackDamage', 'Ramp']
        data = curve_table(1, [
            (0, simple_curve(1, [(1, 0.21), (4, 0.21)])),  # constant: 2★/3★ hold the 1★ key
            (1, simple_curve(1, [(1, 40), (2, 60), (3, 90), (4, 135)])),
            (2, simple_curve(0, [(1, 10), (3, 30)], zero_interp=True)),  # linear
        ])
        rows = parse_curve_table(data, StubPackage(names))
        self.assertEqual(star_values(rows['HexPercentDamageFalloffTooltip']), [0.21, 0.21, 0.21])
        self.assertEqual(star_values(rows['AutoAttackDamage']), [40, 60, 90])
        self.assertEqual(star_values(rows['Ramp']), [10, 20, 30])

    def test_rich_curve_keys(self):
        key = lambda t, v: bytes([1, 0, 0]) + struct.pack('<ff', t, v) + b'\0' * 16
        curve = header([(0, 4, None)]) + struct.pack('<i', 2) + key(1, 455) + key(3, 3500) \
            + struct.pack('<f', FLT_MAX) + bytes([4, 4])
        rows = parse_curve_table(curve_table(2, [(0, curve)]), StubPackage(['OrbDamage']))
        self.assertEqual(star_values(rows['OrbDamage']), [455, 455, 3500])

    def test_trailing_bytes_are_an_error(self):
        data = curve_table(1, [(0, simple_curve(1, [(1, 1)]))]) + b'\0'
        with self.assertRaises(ValueError):
            parse_curve_table(data, StubPackage(['Row']))


class TextureTest(unittest.TestCase):
    def platform_data(self, fmt, w, h, mips):
        name = fmt.encode() + b'\0'
        out = b'\xAA' * 12 + struct.pack('<iii', w, h, 1) + struct.pack('<i', len(name)) + name
        return out + struct.pack('<ii', 0, len(mips)) + b''.join(mips)

    def test_inline_mip0(self):
        pixels = bytes(range(64))
        mip = struct.pack('<i', 0) + pixels + struct.pack('<iii', 4, 4, 1)
        fmt, w, h, data = texture_mip0(self.platform_data('PF_B8G8R8A8', 4, 4, [mip]))
        self.assertEqual((fmt, w, h, data), ('PF_B8G8R8A8', 4, 4, pixels))

    def test_mip0_in_bulk_file(self):
        bulk = bytes(range(32))  # 8×8 DXT1 = 4 blocks × 8 bytes
        mip0 = struct.pack('<i', 0) + struct.pack('<iii', 8, 8, 1)
        mip1 = struct.pack('<i', 1) + b'\x11' * 8 + struct.pack('<iii', 4, 4, 1)
        export = self.platform_data('PF_DXT1', 8, 8, [mip0, mip1])
        self.assertEqual(texture_mip0(export, bulk)[3], bulk)
        with self.assertRaises(ValueError):
            texture_mip0(export)  # .ubulk needed but not given


def ftext(source, wide=False):
    """FText with a Base history: flags, history type, namespace, key, source."""
    key = b'0BC684724B0A78626EC5B08208FB3DB2\0'
    out = struct.pack('<iB', 0, 0) + struct.pack('<i', 1) + b'\0' + struct.pack('<i', len(key)) + key
    if wide:
        data = (source + '\0').encode('utf-16le')
        return out + struct.pack('<i', -(len(data) // 2)) + data
    data = source.encode('latin1') + b'\0'
    return out + struct.pack('<i', len(data)) + data


class FTextTest(unittest.TestCase):
    def test_reads_source_strings_in_order(self):
        buf = b'\x00\x0a' + ftext('Gain <Keyword>Precision</>.') + b'\x01\x02' + ftext('Ally’s shield', wide=True)
        self.assertEqual(read_ftexts(buf), ['Gain <Keyword>Precision</>.', 'Ally’s shield'])

    def test_repairs_windows_1252_punctuation(self):
        # Riot stores some ’ as Latin-1 0x92 (a C1 control) in narrow strings.
        self.assertEqual(read_ftexts(ftext('The holder\x92s attack')), ['The holder’s attack'])


class ContainerTest(unittest.TestCase):
    def test_refuses_encrypted_containers(self):
        toc = bytearray(144)
        toc[:16] = TOC_MAGIC
        toc[16] = 8  # version
        toc[80] = 0x02 | 0x08  # Encrypted | Indexed
        with tempfile.TemporaryDirectory() as d:
            base = os.path.join(d, 'chunk')
            with open(base + '.utoc', 'wb') as f:
                f.write(toc)
            with self.assertRaises(EncryptedContainerError):
                Container(base)


if __name__ == '__main__':
    unittest.main()
