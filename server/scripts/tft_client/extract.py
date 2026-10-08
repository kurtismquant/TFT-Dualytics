"""Extracts Set <N> unit ability values, item tooltips and their icons from the
local TFT (Unreal) client.

Since Set 18 the unit and item data lives in the Unreal client, not in the
League-side files CommunityDragon exports (those carry placeholder unit spells
and no Set 18 item descriptions). Writes:
  server/data/abilityData.set<N>.json            (units.py)
  server/data/itemData.set<N>.json               (items.py)
  client/public/assets/abilities/set<N>/<apiName>.png
  client/public/assets/stat-icons/<stat>.png     (stats the site had no icon for)
The server merges the JSON into its asset data (services/clientAbilityData.js,
services/clientItemData.js).

Run from the repo root after each TFT patch, then commit the output:
  python -I server/scripts/tft_client/extract.py
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
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # sibling modules under python -I

from game import Game  # noqa: E402
from iostore import Oodle, OODLE_DLL_NAME  # noqa: E402
from items import extract_items  # noqa: E402
from uasset import texture_mip0, PIXEL_FORMATS  # noqa: E402
from units import extract_units  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
DEFAULT_INSTALL = r'C:\Riot Games\Teamfight Tactics\Live'

# Item stats the site had no icon for. The client's UI glyphs are white masks
# the game tints at runtime; tint them here in colours that don't clash with
# the existing stat icons (AD orange, AS yellow, HP green, MR cyan, AP violet).
STAT_ICONS = {
    'crit_chance': ('/UI_Shared/Textures/Icons/T_Icon_Crit_Chance', (242, 92, 74)),
    'crit_damage': ('/UI_Shared/Textures/Icons/T_Icon_Crit_Damage', (242, 92, 74)),
    'omnivamp': ('/UI_Shared/Textures/Icons/T_Icon_Omnivamp', (226, 76, 120)),
}


def export_stat_icons(game, out_dir, report):
    from PIL import Image
    for name, (package_path, colour) in STAT_ICONS.items():
        path = game.file_for(package_path)
        if not path:
            report['stat icons missing'].append(package_path)
            continue
        pkg = game.package(package_path)
        bulk_path = path[:-len('.uasset')] + '.ubulk'
        fmt, w, h, payload = texture_mip0(pkg.export_data(pkg.exports[0]), game.read(bulk_path) if bulk_path in game.where else None)
        decoder, *_ = PIXEL_FORMATS[fmt]
        mask = Image.frombytes('RGBA', (w, h), payload, *decoder).getchannel('A')
        tinted = Image.new('RGBA', (w, h), colour + (0,))
        tinted.putalpha(mask)
        tinted.resize((72, 72), Image.LANCZOS).save(os.path.join(out_dir, f'{name}.png'), optimize=True)


def prune(directory, keep, report):
    """Drop generated PNGs that this run didn't produce (units that left the set)."""
    for name in os.listdir(directory):
        if name.endswith('.png') and name not in keep:
            os.remove(os.path.join(directory, name))
            report['removed stale icons'].append(name)


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


def write_json(path, meta, entries):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(format_json({'_meta': meta, **entries}))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--install', default=os.environ.get('TFT_INSTALL', DEFAULT_INSTALL))
    ap.add_argument('--oodle', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '.bin', OODLE_DLL_NAME))
    ap.add_argument('--set', type=int, default=None)
    args = ap.parse_args()

    if re.search(r'(^|[\\/])pbe([\\/]|$)', args.install, re.I):
        sys.exit('Refusing to read the PBE client: its content is unreleased.')
    set_number = args.set or read_current_set()
    data_dir = os.path.join(REPO, 'server', 'data')
    ability_icons = os.path.join(REPO, 'client', 'public', 'assets', 'abilities', f'set{set_number}')
    stat_icons = os.path.join(REPO, 'client', 'public', 'assets', 'stat-icons')
    for d in (ability_icons, stat_icons):
        os.makedirs(d, exist_ok=True)

    game = Game(args.install, Oodle(args.oodle))
    meta = {'source': 'TFT client (Live)', **read_build(args.install), 'extractedAt': datetime.date.today().isoformat()}
    report = collections.defaultdict(list)

    units = extract_units(game, set_number, ability_icons, f'/assets/abilities/set{set_number}', report)
    write_json(os.path.join(data_dir, f'abilityData.set{set_number}.json'), meta, units)
    prune(ability_icons, {f'{k}.png' for k, v in units.items() if v['icon']}, report)

    items = extract_items(game, set_number, report)
    write_json(os.path.join(data_dir, f'itemData.set{set_number}.json'), meta, items)
    export_stat_icons(game, stat_icons, report)

    print(f'Set {set_number}, client build {meta.get("branch")}:')
    print(f'  units: {len(units)} ({sum(1 for e in units.values() if e["icon"])} ability icons, '
          f'{sum(len(e["tokens"]) for e in units.values())} calculations, {sum(len(e["rows"]) for e in units.values())} curve rows)')
    print(f'  items: {len(items)} ({sum(1 for e in items.values() if e["desc"])} with descriptions, '
          f'{sum(1 for e in items.values() if e["stats"])} with stat lines)')
    for kind, lines in report.items():
        if not lines:
            continue
        print(f'  {kind} ({len(lines)}):')
        for line in lines:
            print(f'    {line}')
    if report['units failed'] or report['items failed']:
        sys.exit(1)  # a layout no longer parses: the output is incomplete


if __name__ == '__main__':
    main()
