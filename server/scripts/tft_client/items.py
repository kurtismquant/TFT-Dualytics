"""Item tooltips: the stat line and description text of every item in the set.

The set's item table (Set_<N>/Shared/DataTables/DA_<N>_ItemsTable) imports
each item's data asset. An item asset holds its tooltip as Unreal rich text,
two FText properties on the item object:
  stat line:   <TFTCurveTable row="AttackDamage" icon="Icon.AD" type="stat" format="percent"/> …
  description: Gain <Keyword>Precision</>. <Rules>…</>
The tags reference rows of the item's curve tables and, for a few items,
calculations in its CalcComponent. The text is kept as-is; the server turns it
into the site's tooltip markup (server/services/clientItemData.js).
"""

import re

from uasset import Package, parse_calc_component, read_ftexts
from units import STAR_HEALTH_TABLE, Unsupported, UnitEvaluator, display_values, tidy

ITEM_TABLE = '/Set_{n}/Shared/DataTables/DA_{n}_ItemsTable'
STAT_TAG = re.compile(r'<TFT\w+\b[^>]*\btype="stat"[^>]*/>', re.I)


def set_item_packages(game, set_number):
    table = game.package(ITEM_TABLE.format(n=set_number))
    if table is None:
        raise RuntimeError(f'item table {ITEM_TABLE.format(n=set_number)} not found')
    return [p for p in table.imported_packages if p.rsplit('/', 1)[-1].startswith('DA_')]


def split_texts(texts):
    """A text made only of type="stat" tags is the stat line; the rest is the description."""
    texts = [t for t in texts if t.strip()]
    stats = [t for t in texts if not STAT_TAG.sub('', t).strip()]
    desc = [t for t in texts if t not in stats]
    return ' '.join(stats), '\r\n\r\n'.join(desc)


def item_rows(game, pkg, path):
    """Rows of the curve tables the item names (soft paths in its name map),
    then of any other table in its folder. Items don't scale with star level:
    a row's first key is the value its tooltip shows."""
    tables = [n for n in pkg.names if n.startswith('/') and '/CT_' in n.rsplit('/', 1)[-1]]
    folder = path.rsplit('/', 1)[0] + '/'
    tables += [game.to_package_path(p) for p in sorted(game.where)
               if p.startswith(folder) and re.search(r'/CT_[^/]+\.uasset$', p)]
    rows = {}
    for table in dict.fromkeys(t for t in tables if t):
        for name, curve in (game.curve_table(table) or {}).items():
            if name not in rows and curve['keys']:
                rows[name] = tidy(curve['keys'][0][1])
    return rows


def extract_item(game, package_path, health_curve):
    path = game.file_for(package_path)
    if not path:
        raise RuntimeError('asset not found')
    api_name = package_path.rsplit('/', 1)[-1]
    pkg = Package(game.read(path))
    exports = {e['name']: e for e in pkg.exports}
    texts = read_ftexts(pkg.export_data(exports[api_name])) if api_name in exports else []
    names = read_ftexts(pkg.export_data(exports['NameComponent'])) if 'NameComponent' in exports else []
    stats, desc = split_texts(texts)
    entry = {'name': names[0] if names else '', 'stats': stats, 'desc': desc,
             'rows': item_rows(game, pkg, path), 'tokens': {}}

    problems = []
    if 'CalcComponent' in exports:
        mods, _ = parse_calc_component(pkg.export_data(exports['CalcComponent']), pkg)
        evaluator = UnitEvaluator(game, {}, mods, health_curve)
        for name in dict.fromkeys(m['attribute'] for m in mods):
            try:
                entry['tokens'][name] = display_values([evaluator.attribute(name, 1)])[0]
            except Unsupported as err:
                problems.append(f'{name}: {err}')
    return entry, problems


def extract_items(game, set_number, report):
    """→ {apiName: entry} for every item in the set's item table."""
    health_curve = game.curve(STAR_HEALTH_TABLE, 'Health')
    out = {}
    for package_path in sorted(set_item_packages(game, set_number)):
        api_name = package_path.rsplit('/', 1)[-1]
        try:
            entry, problems = extract_item(game, package_path, health_curve)
        except Exception as err:
            report['items failed'].append(f'{api_name}: {type(err).__name__}: {err}')
            continue
        if not entry['stats'] and not entry['desc']:
            report['items without tooltip text'].append(api_name)
        report['item values unresolved'] += [f'{api_name}.{p}' for p in problems]
        out[api_name] = entry
    return out
