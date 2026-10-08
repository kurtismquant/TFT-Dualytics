"""Extracts Set <N> ability values and icons from the local TFT (Unreal) client.

Since Set 18 the unit data lives in the Unreal client, not in the League-side
files CommunityDragon exports (those only carry placeholder spells). Each unit
is a data asset, Set_<N>/Content/Champions/<Unit>/DA_<apiName>, with:
  - CalcComponent: the tooltip calculations ("MagicDamageCalc1") as Gameplay
    Ability System modifiers over curve-table rows and unit attributes;
  - AbilityComponent: base attributes (HealthMax, AttackDamage, …);
  - ChampionSpellDataComponent: a soft path to the ability icon texture.
Curve tables (CT_*) hold the per-star-level numbers. This script evaluates
every calculation at 1★/2★/3★ the way GAS aggregates modifiers, collects the
unit's curve rows, exports the icon as PNG and writes:
  server/data/abilityData.set<N>.json
  client/public/assets/abilities/set<N>/<apiName>.png
The server merges the JSON into unit abilities (see services/clientAbilityData.js).

Run from the repo root after each TFT patch, then commit the output:
  python -I server/scripts/tft_client/extract_abilities.py
Options: --install <TFT Live folder> (default C:\\Riot Games\\Teamfight Tactics\\Live),
         --oodle <oodle-data-shared.dll> (default server/scripts/tft_client/.bin/).
Requires Pillow (requirements.txt) and the pinned Oodle DLL (see iostore.py).

Only the Live client is read: PBE content is unreleased and must not reach the
site. The script only reads files; it never touches the running game.
"""

import argparse
import collections
import datetime
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # sibling modules under python -I

from iostore import Container, EncryptedContainerError, Oodle, OODLE_DLL_NAME  # noqa: E402
from uasset import (  # noqa: E402
    Package, evaluate_curve, parse_base_attributes, parse_calc_component,
    parse_curve_table, parse_soft_object_path_prop0, star_values, texture_to_png,
)

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DEFAULT_INSTALL = r'C:\Riot Games\Teamfight Tactics\Live'
STAR_HEALTH_TABLE = '/Set_Shared/UnitLevelUp/CT_UnitStatMultiplier_PerStarLevel'

# EGameplayModOp as stored by Riot's GAS fork. 0–3 match Epic's enum. Epic
# numbers MultiplyCompound 4 and AddFinal 5; Riot's assets use 6 and 7 for
# them instead (inferred from use: Caitlyn's PhysicalDamageCalc3 is
# (Calc2 × Stack) + Calc1 with Calc1 under op 7; Ivern's shield multiplies by
# OutgoingDamageMultiplier under op 6). Anything else is reported, not guessed.
OP_ADD_BASE, OP_MULTIPLY_ADDITIVE, OP_DIVIDE_ADDITIVE, OP_OVERRIDE = 0, 1, 2, 3
OP_MULTIPLY_COMPOUND, OP_ADD_FINAL = 6, 7
KNOWN_OPS = {OP_ADD_BASE, OP_MULTIPLY_ADDITIVE, OP_DIVIDE_ADDITIVE, OP_OVERRIDE, OP_MULTIPLY_COMPOUND, OP_ADD_FINAL}

# Attributes a tooltip is evaluated at that aren't in the unit's base map. Set
# 18 shows AP and AD as multipliers (100% = 1.0); most units list AttackDamage
# 1.0 explicitly, a few omit it (Draven) and get the same default. Combat-only
# state is neutral.
DEFAULT_ATTRIBUTES = {
    'AbilityPower': lambda star: 1.0,
    'AttackDamage': lambda star: 1.0,
    'Level': lambda star: float(star),
    'Stack': lambda star: 0.0,
    'OutgoingDamageMultiplier': lambda star: 1.0,
}


class Unsupported(Exception):
    pass


class Game:
    """All non-encrypted IoStore containers of an install, plus helpers to
    resolve "/Plugin/Path/Asset" package paths and load curve tables."""

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

    def read(self, path):
        return self.where[path].read(path)

    def curve_table(self, package_path):
        if package_path not in self._tables:
            path = self.file_for(package_path)
            rows = None
            if path:
                pkg = Package(self.read(path))
                rows = parse_curve_table(pkg.export_data(pkg.exports[0]), pkg)
            self._tables[package_path] = rows
        return self._tables[package_path]

    def curve(self, package_path, row):
        rows = self.curve_table(package_path)
        return rows.get(row) if rows else None


class UnitEvaluator:
    """Evaluates GAS attributes for one unit at a star level."""

    def __init__(self, game, base, modifiers, health_curve):
        self.game = game
        self.base = base
        self.health_curve = health_curve
        self.mods = collections.defaultdict(list)
        for m in modifiers:
            self.mods[m['attribute']].append(m)

    def base_value(self, name, star):
        if name == 'HealthMax' and name in self.base:
            if self.health_curve is None:
                raise Unsupported('no per-star health multiplier table')
            return self.base[name] * evaluate_curve(self.health_curve, star)
        if name in self.base:
            return self.base[name]
        if name in DEFAULT_ATTRIBUTES:
            return DEFAULT_ATTRIBUTES[name](star)
        if name in self.mods:
            return 0.0  # calculation attributes start at zero
        raise Unsupported(f'attribute {name or "(unnamed)"}')

    def attribute(self, name, star, depth=0):
        if depth > 32:
            raise Unsupported('calculation cycle')
        value = self.base_value(name, star)
        mods = self.mods.get(name, [])
        # GAS evaluates channels in ascending order; each channel's result is
        # the next one's base. Within a channel:
        #   ((base + ΣAddBase) × MultiplyAdditive / DivideAdditive × ΠMultiplyCompound) + ΣAddFinal
        # where additive multipliers/divisors sum their (magnitude − 1) onto 1,
        # and the first Override replaces the channel's result outright.
        for channel in sorted({m['channel'] for m in mods}):
            in_channel = [m for m in mods if m['channel'] == channel]
            unknown = {m['op'] for m in in_channel} - KNOWN_OPS
            if unknown:
                raise Unsupported(f'modifier op {sorted(unknown)}')
            override = next((m for m in in_channel if m['op'] == OP_OVERRIDE), None)
            if override:
                value = self.magnitude(override, star, depth)
                continue
            mag = lambda op: [self.magnitude(m, star, depth) for m in in_channel if m['op'] == op]
            add = sum(mag(OP_ADD_BASE))
            mult = 1 + sum(v - 1 for v in mag(OP_MULTIPLY_ADDITIVE))
            div = 1 + sum(v - 1 for v in mag(OP_DIVIDE_ADDITIVE))
            if abs(div) < 1e-9:
                div = 1.0
            compound = math.prod(mag(OP_MULTIPLY_COMPOUND))
            value = (value + add) * mult / div * compound + sum(mag(OP_ADD_FINAL))
        return value

    def scalable(self, sf, star):
        """FScalableFloat: Value × Curve(level), or Value without a curve."""
        if sf is None:
            return 0.0
        if not sf['curve']:
            return sf['value']
        curve = self.game.curve(*sf['curve'])
        v = evaluate_curve(curve, star) if curve else None
        if v is None:
            raise Unsupported(f'curve {sf["curve"][1]} not found')
        return sf['value'] * v

    def magnitude(self, mod, star, depth):
        mg = mod['magnitude']
        if mg['type'] == 0:  # ScalableFloat
            return self.scalable(mg['scalable'], star)
        if mg['type'] == 1:  # AttributeBased: Coeff × (Attr + Pre) + Post
            ab = mg['attributeBased']
            if ab is None or ab['calcType'] != 0:
                raise Unsupported('attribute-based magnitude variant')
            attr = self.attribute(ab['attribute'], star, depth + 1)
            if ab['attributeCurve']:
                curve = self.game.curve(*ab['attributeCurve'])
                if curve is None:
                    raise Unsupported('attribute lookup curve not found')
                attr = evaluate_curve(curve, attr)
            return self.scalable(ab['coefficient'], star) * (attr + self.scalable(ab['pre'], star)) \
                + self.scalable(ab['post'], star)
        raise Unsupported('custom or set-by-caller magnitude')


def tidy(v):
    v = round(v, 4)
    return int(v) if v == int(v) else v


def display_values(values):
    """Calculations that reach 10 are amounts (damage, heals, shields from
    %HP), which the game shows as whole numbers — rounded half-up like
    FMath::RoundToInt. Smaller ones are ratios/attack-speed bonuses and keep
    their decimals."""
    if max(abs(v) for v in values) >= 10:
        return [math.floor(v + 0.5) for v in values]
    return [tidy(v) for v in values]


TOOLTIP_FORMATS = {'percent': 'percent', 'p': 'percent', 'percentminusone': 'percentMinusOne'}


def tooltip_formats(description_export):
    """The client's own tooltip text tags each value with how to show it:
    <TFTCurveTable row="SpellAS" format="percentMinusOne"/> renders 1.85 as
    "85%". CDragon's description lost those hints, so carry them over. FText
    strings are Latin-1, or UTF-16 when they hold non-ASCII text."""
    data = description_export
    text = '\n'.join([data.decode('latin1'), data.decode('utf-16le', 'ignore'), data[1:].decode('utf-16le', 'ignore')])
    formats = {}
    for tag in re.findall(r'<TFT(?:CurveTable|Attribute)\b[^>]*/>', text):
        attrs = {k.lower(): v for k, v in re.findall(r'(\w+)="([^"]*)"', tag)}
        name = attrs.get('row') or attrs.get('attributeid', '').split('.')[-1]
        fmt = TOOLTIP_FORMATS.get(attrs.get('format', '').lower())
        if name and fmt:
            formats[name] = fmt
    return formats


def unit_rows(game, table_paths):
    """Star values of every row in the unit's own curve tables (first table wins)."""
    rows = {}
    for table in table_paths:
        for name, curve in (game.curve_table(table) or {}).items():
            if name not in rows:
                values = star_values(curve)
                if None not in values:
                    rows[name] = [tidy(v) for v in values]
    return rows


def extract_unit(game, path, health_curve):
    pkg = Package(game.read(path))
    exports = {e['name']: e for e in pkg.exports}
    entry = {'icon': None, 'tokens': {}, 'rows': {}}
    problems = []

    base, derived = ({}, [])
    if 'AbilityComponent' in exports:
        base, derived = parse_base_attributes(pkg.export_data(exports['AbilityComponent']), pkg)
    calc_mods, main_table = ([], None)
    if 'CalcComponent' in exports:
        calc_mods, main_table = parse_calc_component(pkg.export_data(exports['CalcComponent']), pkg)

    evaluator = UnitEvaluator(game, base, derived + calc_mods, health_curve)
    for name in dict.fromkeys(m['attribute'] for m in calc_mods):
        try:
            entry['tokens'][name] = display_values([evaluator.attribute(name, star) for star in (1, 2, 3)])
        except Unsupported as err:
            problems.append(f'{name}: {err}')

    # Rows for tooltip tokens that name a curve row directly
    # (<TFTCurveTable row="HexRadius"/>): the unit's main table first, then the
    # other curve tables under its champion folder — forms can sit in sibling
    # folders (Elise/Base, Elise/Shifted). VFX curves aren't tooltip data.
    unit_dir = re.match(r'^(.*/Champions/[^/]+/)', path).group(1)
    folder_tables = sorted(
        p for p in game.where
        if p.startswith(unit_dir) and re.search(r'/CT_[^/]+\.uasset$', p) and '/VFX/' not in p
    )
    tables = [main_table] + [to_package_path(game, p) for p in folder_tables]
    entry['rows'] = unit_rows(game, [t for t in dict.fromkeys(tables) if t])
    if 'SpellDescriptionComponent' in exports:
        formats = tooltip_formats(pkg.export_data(exports['SpellDescriptionComponent']))
        if formats:
            entry['formats'] = formats
    return pkg, exports, entry, problems


def to_package_path(game, file_path):
    for mount, prefix in game.mounts.items():
        if file_path.startswith(prefix):
            return mount + file_path[len(prefix):-len('.uasset')]
    return None


def export_icon(game, pkg, exports, out_dir, api_name):
    if 'ChampionSpellDataComponent' not in exports:
        return None, 'no spell data'
    texture = parse_soft_object_path_prop0(pkg.export_data(exports['ChampionSpellDataComponent']), pkg)
    path = game.file_for(texture)
    if not path:
        return None, f'icon {texture} not found'
    tex = Package(game.read(path))
    bulk_path = path[:-len('.uasset')] + '.ubulk'
    bulk = game.read(bulk_path) if bulk_path in game.where else None
    texture_to_png(tex.export_data(tex.exports[0]), os.path.join(out_dir, f'{api_name}.png'), bulk)
    return texture, None


def read_current_set():
    with open(os.path.join(REPO, 'server', 'constants', 'game.js'), encoding='utf-8') as f:
        return int(re.search(r'CURRENT_SET\s*=\s*(\d+)', f.read()).group(1))


def read_build(install):
    try:
        with open(os.path.join(install, 'Engine', 'Build', 'Build.version'), encoding='utf-8') as f:
            info = json.load(f)
        return {'branch': info.get('BranchName'), 'changelist': info.get('Changelist')}
    except (OSError, ValueError):
        return {}


def format_json(obj):
    text = json.dumps(obj, indent=2, ensure_ascii=False)
    # Keep star arrays on one line, like abilityOverrides.set<N>.json.
    one_line = lambda m: '[' + ', '.join(v.strip() for v in m.group(1).split(',')) + ']'
    return re.sub(r'\[\s+([-\d.e,\s]+?)\s+\]', one_line, text) + '\n'


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--install', default=os.environ.get('TFT_INSTALL', DEFAULT_INSTALL))
    ap.add_argument('--oodle', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '.bin', OODLE_DLL_NAME))
    ap.add_argument('--set', type=int, default=None)
    args = ap.parse_args()

    if re.search(r'(^|[\\/])pbe([\\/]|$)', args.install, re.I):
        sys.exit('Refusing to read the PBE client: its content is unreleased.')
    set_number = args.set or read_current_set()
    out_json = os.path.join(REPO, 'server', 'data', f'abilityData.set{set_number}.json')
    icon_dir = os.path.join(REPO, 'client', 'public', 'assets', 'abilities', f'set{set_number}')
    icon_url = f'/assets/abilities/set{set_number}'
    os.makedirs(icon_dir, exist_ok=True)

    game = Game(args.install, Oodle(args.oodle))
    health_curve = game.curve(STAR_HEALTH_TABLE, 'Health')
    unit_re = re.compile(rf'^TFT/Plugins/GameFeatures/Set_{set_number}/Content/Champions/.+/(DA_[^/]+)\.uasset$')
    units = sorted((m.group(1), p) for p in game.where if (m := unit_re.match(p)))

    out = {'_meta': {'source': 'TFT client (Live)', **read_build(args.install),
                     'extractedAt': datetime.date.today().isoformat()}}
    report = collections.defaultdict(list)
    for api_name, path in units:
        try:
            pkg, exports, entry, problems = extract_unit(game, path, health_curve)
        except Exception as err:  # malformed/unknown layout: report and keep going
            report['failed'].append(f'{api_name}: {type(err).__name__}: {err}')
            continue
        if 'ChampionSpellDataComponent' not in exports:
            continue  # projectiles, trait helpers: not shop units
        try:
            texture, why = export_icon(game, pkg, exports, icon_dir, api_name)
        except Exception as err:
            texture, why = None, f'{type(err).__name__}: {err}'
        if texture:
            entry['icon'] = f'{icon_url}/{api_name}.png'
        else:
            report['no icon'].append(f'{api_name}: {why}')
        report['unresolved'] += [f'{api_name}.{p}' for p in problems]
        out[api_name] = entry

    with open(out_json, 'w', encoding='utf-8', newline='\n') as f:
        f.write(format_json(out))
    # Drop icons of units that left the set (the folder is generated output).
    current = {f'{k}.png' for k, v in out.items() if k != '_meta' and v['icon']}
    for name in os.listdir(icon_dir):
        if name.endswith('.png') and name not in current:
            os.remove(os.path.join(icon_dir, name))
            print(f'  removed stale icon {name}')
    entries = [v for k, v in out.items() if k != '_meta']
    print(f'Wrote {len(entries)} units to {os.path.relpath(out_json, REPO)} (build {out["_meta"].get("branch")})')
    print(f'  icons: {sum(1 for e in entries if e["icon"])} -> {os.path.relpath(icon_dir, REPO)}')
    print(f'  calculations: {sum(len(e["tokens"]) for e in entries)}, curve rows: {sum(len(e["rows"]) for e in entries)}')
    for kind in ('failed', 'no icon', 'unresolved'):
        if report[kind]:
            print(f'  {kind} ({len(report[kind])}):')
            for line in report[kind]:
                print(f'    {line}')
    if report['failed']:
        sys.exit(1)  # a unit's layout no longer parses: the output is incomplete


if __name__ == '__main__':
    main()
