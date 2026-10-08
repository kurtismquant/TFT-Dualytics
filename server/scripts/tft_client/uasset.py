"""Minimal reader for cooked Unreal 5.7 zen packages (.uasset inside IoStore).

Only what the ability extractor needs: the name map, the export map, the
unversioned property header, CurveTable rows and Texture2D pixels. Cooked
packages use *unversioned* property serialization: values are written without
names or sizes, in schema order, so only structs whose schema is known here
(engine curve structs) can be decoded field by field.
"""

import re
import struct

PACKAGE_FILE_TAG = 0x9E2A83C1
# FZenPackageSummary (UE 5.4+, incl. the Verse cell import/export offsets);
# the name map follows it directly when bHasVersioningInfo is 0.
ZEN_SUMMARY_SIZE = 60
NAME_HASH_VERSION = 0xC1640000
EXPORT_ENTRY_SIZE = 72
NULL_INDEX = 0xFFFFFFFFFFFFFFFF


def read_name_batch(data, p):
    """FName batch (name map, imported package names): count, string bytes,
    hash version, per-name hashes, big-endian length headers (top bit =
    UTF-16), then the strings back to back."""
    count = struct.unpack_from('<I', data, p)[0]
    if count == 0:
        return [], p + 4
    _string_bytes, hash_version = struct.unpack_from('<IQ', data, p + 4)
    if hash_version != NAME_HASH_VERSION:
        raise ValueError(f'unexpected name batch hash version {hash_version:#x}')
    p += 16 + count * 8
    headers = [struct.unpack_from('>H', data, p + i * 2)[0] for i in range(count)]
    p += count * 2
    names = []
    for h in headers:
        n = h & 0x7FFF
        if h & 0x8000:
            names.append(data[p:p + n * 2].decode('utf-16le'))
            p += n * 2
        else:
            names.append(data[p:p + n].decode('latin1'))
            p += n
    return names, p


class Package:
    def __init__(self, data):
        self.data = data
        has_versioning, self.header_size = struct.unpack_from('<II', data, 0)
        if has_versioning:
            raise ValueError('versioned zen packages are not supported')
        (self.package_flags, self.cooked_header_size, _imported_hashes, self.import_map_at,
         self.export_map_at, self.export_bundles_at, _dep_headers, _dep_entries,
         imported_names_at) = struct.unpack_from('<IIiiiiiii', data, 16)
        self.names, _ = read_name_batch(data, ZEN_SUMMARY_SIZE)
        self.exports = self._read_export_map()
        self.imports = [
            struct.unpack_from('<Q', data, self.import_map_at + i * 8)[0]
            for i in range((self.export_map_at - self.import_map_at) // 8)
        ]
        # Paths of the packages this one hard-imports, indexed by package imports.
        self.imported_packages = []
        if 0 < imported_names_at < self.header_size:
            self.imported_packages, _ = read_name_batch(data, imported_names_at)

    def import_package(self, package_index):
        """FPackageIndex (negative = import) → path of the imported package, or
        None for null/script/export references."""
        if package_index >= 0:
            return None
        value = self.imports[-package_index - 1]
        if value >> 62 != 2:  # FPackageObjectIndex type PackageImport
            return None
        imported = (value >> 32) & 0x3FFFFFFF
        return self.imported_packages[imported] if imported < len(self.imported_packages) else None

    def _read_export_map(self):
        exports = []
        count = (self.export_bundles_at - self.export_map_at) // EXPORT_ENTRY_SIZE
        for i in range(count):
            p = self.export_map_at + i * EXPORT_ENTRY_SIZE
            serial_offset, serial_size, name_index, name_number = struct.unpack_from('<QQII', self.data, p)
            outer, cls, sup, template = struct.unpack_from('<QQQQ', self.data, p + 24)
            exports.append({
                'name': self.fname(name_index, name_number),
                # Zen packages lay export data out after the header; the cooked
                # serial offset is relative to that start.
                'offset': self.header_size + serial_offset,
                'size': serial_size,
                'outer': outer,
                'class': cls,
            })
        return exports

    def fname(self, index, number=0):
        name = self.names[index]
        return f'{name}_{number - 1}' if number else name

    def export_data(self, export):
        return self.data[export['offset']:export['offset'] + export['size']]


def read_unversioned_header(buf, p):
    """Returns ([(schemaIndex, isZero)...], next offset). Zero-flagged
    properties hold their type's zero value and have no serialized bytes."""
    fragments = []
    while True:
        v = struct.unpack_from('<H', buf, p)[0]
        p += 2
        fragments.append((v & 0x7F, bool(v & 0x80), v >> 9))  # skip, hasZeroes, valueCount
        if v & 0x100:  # last fragment
            break
    zero_bits = sum(n for _, has_zero, n in fragments if has_zero)
    zero_mask = 0
    if zero_bits:
        size = 1 if zero_bits <= 8 else 2 if zero_bits <= 16 else ((zero_bits + 31) // 32) * 4
        zero_mask = int.from_bytes(buf[p:p + size], 'little')
        p += size
    present, index, bit = [], 0, 0
    for skip, has_zero, n in fragments:
        index += skip
        for _ in range(n):
            is_zero = False
            if has_zero:
                is_zero = bool(zero_mask >> bit & 1)
                bit += 1
            present.append((index, is_zero))
            index += 1
    return present, p


# ERichCurveInterpMode
INTERP_LINEAR, INTERP_CONSTANT = 0, 1
FLT_MAX = 3.4028234663852886e38


def _read_curve(buf, p, mode):
    """One FSimpleCurve (mode 1) or FRichCurve (mode 2). Unversioned schema
    order is derived-first: FSimpleCurve [InterpMode, Keys] / FRichCurve [Keys],
    then FRealCurve [DefaultValue, PreInfinityExtrap, PostInfinityExtrap]."""
    present, p = read_unversioned_header(buf, p)
    fields = ['interp', 'keys', 'default', 'pre', 'post'] if mode == 1 else ['keys', 'default', 'pre', 'post']
    curve = {'interp': INTERP_LINEAR, 'keys': [], 'default': FLT_MAX}
    for index, is_zero in present:
        field = fields[index]
        if is_zero:
            curve[field] = [] if field == 'keys' else 0
            continue
        if field == 'interp':
            curve['interp'] = buf[p]
            p += 1
        elif field == 'keys':
            count = struct.unpack_from('<i', buf, p)[0]
            p += 4
            for _ in range(count):
                if mode == 1:  # FSimpleCurveKey: Time, Value
                    t, v = struct.unpack_from('<ff', buf, p)
                    curve['keys'].append((t, v, curve['interp']))
                    p += 8
                else:  # FRichCurveKey: InterpMode, TangentMode, TangentWeightMode, Time, Value, 4 tangent floats
                    t, v = struct.unpack_from('<ff', buf, p + 3)
                    curve['keys'].append((t, v, buf[p]))
                    p += 27
        elif field == 'default':
            curve['default'] = struct.unpack_from('<f', buf, p)[0]
            p += 4
        else:
            p += 1
    if mode == 1:  # simple curves share one interp mode across keys
        curve['keys'] = [(t, v, curve['interp']) for t, v, _ in curve['keys']]
    return curve, p


def evaluate_curve(curve, time):
    keys = curve['keys']
    if not keys:
        return None if curve['default'] == FLT_MAX else curve['default']
    if time <= keys[0][0]:
        return keys[0][1]
    for (t0, v0, interp), (t1, v1, _) in zip(keys, keys[1:]):
        if t0 <= time < t1:
            if interp == INTERP_CONSTANT:
                return v0
            return v0 + (v1 - v0) * (time - t0) / (t1 - t0)
    return keys[-1][1]


def parse_curve_table(export_data, package):
    """UCurveTable export → {rowName: curve}. Layout: (empty) UObject property
    header, object GUID flag, int32 row count, uint8 ECurveTableMode, then per
    row an FName and the curve struct."""
    buf = export_data
    present, p = read_unversioned_header(buf, 0)
    if present:
        raise ValueError('curve table has object properties (composite table?)')
    p += 4  # bool HasObjectGuid (always 0 in cooked data)
    row_count = struct.unpack_from('<i', buf, p)[0]
    p += 4
    mode = buf[p]
    p += 1
    if mode not in (0, 1, 2):
        raise ValueError(f'unknown curve table mode {mode}')
    rows = {}
    for _ in range(row_count if mode else 0):
        name_index, number = struct.unpack_from('<II', buf, p)
        p += 8
        rows[package.fname(name_index, number)], p = _read_curve(buf, p, mode)
    if p != len(buf):
        raise ValueError(f'curve table parse ended at {p}, export is {len(buf)} bytes')
    return rows


def star_values(curve):
    """Curve keys are star levels (1★..4★). Returns [1★, 2★, 3★]."""
    out = []
    for star in (1, 2, 3):
        v = evaluate_curve(curve, star)
        out.append(None if v is None else round(v, 4))
    return out


# --- Gameplay Ability System structs -------------------------------------
# Set 18 unit data assets describe tooltip calculations ("MagicDamageCalc1")
# and base stats with Unreal's GAS structs. Their unversioned schemas are the
# engine's declaration order, so they decode without a mappings file.

class Reader:
    def __init__(self, buf, package, p=0):
        self.buf, self.package, self.p = buf, package, p

    def take(self, fmt):
        v = struct.unpack_from(fmt, self.buf, self.p)
        self.p += struct.calcsize(fmt)
        return v[0] if len(v) == 1 else v

    def fname(self):
        index, number = self.take('<II')
        return self.package.fname(index, number)

    def fstring(self):
        n = self.take('<i')
        if n == 0:
            return ''
        if n > 0:
            s = self.buf[self.p:self.p + n - 1].decode('latin1')
            self.p += n
        else:
            s = self.buf[self.p:self.p + (-n - 1) * 2].decode('utf-16le')
            self.p += -n * 2
        return s

    def struct(self, fields, strict=True):
        """Reads an unversioned struct; `fields` lists one reader per schema
        index. Zero-flagged fields come back as None. A *skipped* field holds
        the struct's default, which isn't always zero (FAttributeBasedFloat's
        Coefficient defaults to 1), so strict mode refuses to guess."""
        present, self.p = read_unversioned_header(self.buf, self.p)
        if strict and [i for i, _ in present] != list(range(len(fields))):
            raise ValueError(f'struct with skipped fields at {self.p}: {present}')
        out = [None] * len(fields)
        for index, is_zero in present:
            if index >= len(fields):
                raise ValueError(f'unexpected property index {index} at {self.p}')
            if not is_zero:
                out[index] = fields[index](self)
        return out


def _byte(r):
    return r.take('<B')


def _float(r):
    return r.take('<f')


def _object(r):
    return r.take('<i')


def _fname(r):
    return r.fname()


def read_attribute(r):
    """FGameplayAttribute → attribute name ("AbilityPower", "MagicDamageCalc1")."""
    def field_path(r):  # FFieldPath: TArray<FName> path + owner object
        count = r.take('<i')
        for _ in range(count):
            r.fname()
        r.take('<i')
    name, _, _ = r.struct([lambda r: r.fstring(), field_path, _object])
    return name


def read_curve_handle(r):
    """FCurveTableRowHandle {CurveTable, RowName} → (package path, row) or None."""
    table, row = r.struct([_object, _fname])
    if table is None or row is None:
        return None
    return r.package.import_package(table), row


def read_scalable_float(r):
    """FScalableFloat {Value, Curve, RegistryType}; value is Value × Curve(level)."""
    value, curve, _ = r.struct([_float, read_curve_handle, lambda r: r.struct([_fname])])
    return {'value': value or 0.0, 'curve': curve}


def _tag_container(r):
    count = r.take('<i')
    for _ in range(count):
        r.fname()
    return count


def read_magnitude(r):
    """FGameplayEffectModifierMagnitude."""
    def attribute_based(r):
        capture = lambda r: r.struct([read_attribute, _byte, _byte])  # attribute, source, snapshot
        (coeff, pre, post, backing, attr_curve, calc_type, _channel,
         _src_tags, _tgt_tags) = r.struct([
            read_scalable_float, read_scalable_float, read_scalable_float, capture,
            read_curve_handle, _byte, _byte, _tag_container, _tag_container,
        ])
        return {
            'coefficient': coeff, 'pre': pre, 'post': post,
            'attribute': backing[0] if backing else None,
            'attributeCurve': attr_curve, 'calcType': calc_type or 0,
        }

    def custom(r):
        cls, coeff, pre, post, _ = r.struct([
            _object, read_scalable_float, read_scalable_float, read_scalable_float, read_curve_handle,
        ])
        return {'class': cls}

    def set_by_caller(r):
        r.struct([_fname, lambda r: r.struct([_fname])])
        return {}

    kind, scalable, attr, cust, sbc = r.struct([_byte, read_scalable_float, attribute_based, custom, set_by_caller])
    kind = kind or 0
    return {'type': kind, 'scalable': scalable, 'attributeBased': attr, 'custom': cust}


def read_modifier(r):
    """TFT calculation modifier: {Attribute, ModifierOp, ModifierMagnitude,
    EvaluationChannelSettings}."""
    attribute, op, magnitude, channel = r.struct([
        read_attribute, _byte, read_magnitude, lambda r: r.struct([_byte])[0],
    ])
    return {'attribute': attribute, 'op': op or 0, 'magnitude': magnitude, 'channel': channel or 0}


def parse_calc_component(export_data, package):
    """CalcComponent → (modifiers, curve table path). Layout: TArray of
    modifiers, then an FSoftObjectPath to the unit's curve table."""
    r = Reader(export_data, package)

    def modifiers(r):
        return [read_modifier(r) for _ in range(r.take('<i'))]

    def soft_path(r):
        pkg, _asset = r.fname(), r.fname()
        r.fstring()
        return pkg

    mods, table = r.struct([modifiers, soft_path], strict=False)
    r.take('<i')  # object GUID flag
    if r.p != len(export_data):
        raise ValueError(f'CalcComponent parse ended at {r.p} of {len(export_data)}')
    return mods or [], table


def parse_base_attributes(export_data, package):
    """AbilityComponent → ({attribute: base value}, [derived modifiers]). The
    first property is {TMap<Attribute, float>, TMap<Attribute, Magnitude>}."""
    r = Reader(export_data, package)

    def tmap(value_reader):
        def read(r):
            removed = r.take('<i')
            if removed:
                raise ValueError('TMap with removed keys')
            return [(read_attribute(r), value_reader(r)) for _ in range(r.take('<i'))]
        return read

    present, r.p = read_unversioned_header(export_data, 0)
    if not present or present[0] != (0, False):
        return {}, []
    base, derived = r.struct([tmap(_float), tmap(read_magnitude)], strict=False)
    mods = [{'attribute': a, 'op': 0, 'magnitude': m, 'channel': 0} for a, m in (derived or [])]
    return dict(base or []), mods


# Pixel format → (Pillow decoder args, bytes per 4×4 block or per pixel, block-compressed?)
PIXEL_FORMATS = {
    'PF_DXT1': (('bcn', 1), 8, True),
    'PF_DXT3': (('bcn', 2), 16, True),
    'PF_DXT5': (('bcn', 3), 16, True),
    'PF_BC7': (('bcn', 7), 16, True),
    'PF_B8G8R8A8': (('raw', 'BGRA'), 4, False),
}


def _mip_bytes(fmt, w, h):
    _, unit, block = PIXEL_FORMATS[fmt]
    return max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * unit if block else w * h * unit


def texture_mip0(export_data, bulk_data=None):
    """Texture2D export → (pixel format, width, height, mip-0 bytes).

    Cooked platform data: SizeX, SizeY, PackedData, FString PixelFormat,
    [OptData], FirstMipToSerialize, mip count, then per mip an int32 bulk-data
    index, the payload when stored inline, and SizeX/SizeY/SizeZ. A payload
    that isn't inline (the dimensions follow the index directly) lives in the
    package's .ubulk, mips back to back."""
    buf = export_data
    at = buf.find(b'PF_')
    if at < 16:
        raise ValueError('no pixel format in texture export')
    n = struct.unpack_from('<i', buf, at - 4)[0]
    fmt = buf[at:at + n - 1].decode('ascii')
    if fmt not in PIXEL_FORMATS:
        raise ValueError(f'unsupported pixel format {fmt}')
    size_x, size_y, packed = struct.unpack_from('<iii', buf, at - 16)
    p = at + n
    if packed & (1 << 30):  # bHasOptData
        p += 8
    _first_mip, mip_count = struct.unpack_from('<ii', buf, p)
    p += 8
    bulk_offset = 0
    for mip in range(mip_count):
        w, h = max(1, size_x >> mip), max(1, size_y >> mip)
        p += 4  # bulk-data index
        size = _mip_bytes(fmt, w, h)
        if struct.unpack_from('<iii', buf, p) == (w, h, 1):
            payload = None if bulk_data is None else bulk_data[bulk_offset:bulk_offset + size]
            bulk_offset += size
        else:
            payload = buf[p:p + size]
            p += size
            if struct.unpack_from('<iii', buf, p) != (w, h, 1):
                raise ValueError(f'mip {mip} dimensions mismatch')
        p += 12
        if mip == 0:
            if payload is None or len(payload) != size:
                raise ValueError('mip 0 is in a .ubulk that was not provided')
            return fmt, w, h, payload
    raise ValueError('texture has no mips')


def texture_to_png(export_data, out_path, bulk_data=None):
    from PIL import Image  # Pillow; only needed for icon export
    fmt, w, h, payload = texture_mip0(export_data, bulk_data)
    decoder, *_ = PIXEL_FORMATS[fmt]
    Image.frombytes('RGBA', (w, h), payload, *decoder).save(out_path, optimize=True)
    return fmt, w, h


FTEXT_KEY = re.compile(rb'\x21\x00\x00\x00[0-9A-F]{32}\x00')


def _fix_cp1252(s):
    """Some Riot strings store Windows-1252 punctuation as Latin-1 C1 controls
    (U+0092 for ’). Map those back; leave everything else untouched."""
    out = []
    for ch in s:
        if '\x80' <= ch <= '\x9f':
            try:
                ch = ch.encode('latin1').decode('cp1252')
            except UnicodeDecodeError:
                pass
        out.append(ch)
    return ''.join(out)


def read_ftexts(buf):
    """Source strings of the FText properties in an export, in order.

    A localized FText serializes as flags, history type, namespace, a
    32-hex-digit key and the source string; the key is distinctive enough to
    find the strings without the owning class's schema."""
    texts = []
    for m in FTEXT_KEY.finditer(buf):
        p = m.end()
        n = struct.unpack_from('<i', buf, p)[0]
        p += 4
        if n > 0:
            texts.append(_fix_cp1252(buf[p:p + n - 1].decode('latin1')))
        elif n < 0:
            texts.append(buf[p:p + (-n - 1) * 2].decode('utf-16le'))
        else:
            texts.append('')
    return texts


def parse_soft_object_path_prop0(export_data, package):
    """First property as an FSoftObjectPath → package path (used for the
    ChampionSpellDataComponent's ability icon)."""
    present, p = read_unversioned_header(export_data, 0)
    if not present or present[0] != (0, False):
        return None
    r = Reader(export_data, package, p)
    return r.fname()
