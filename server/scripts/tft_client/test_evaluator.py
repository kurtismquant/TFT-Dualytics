"""GAS aggregation tests for the ability evaluator (synthetic modifiers)."""

import unittest

from units import (
    OP_ADD_BASE, OP_ADD_FINAL, OP_MULTIPLY_ADDITIVE, OP_OVERRIDE, Unsupported, UnitEvaluator, display_values,
    tooltip_formats,
)

CT = '/Set_18/Champions/Test/CT_Test'


def curve(*values):  # star-keyed constant curve
    return {'keys': [(star, v, 1) for star, v in enumerate(values, start=1)], 'default': 0}


class FakeGame:
    def __init__(self, rows):
        self.rows = rows

    def curve(self, table, row):
        return self.rows.get(row) if table == CT else None


def sf(value=1.0, row=None):
    return {'value': value, 'curve': (CT, row) if row else None}


def attribute_mod(target, backing, coeff_row, op=OP_ADD_BASE, channel=1):
    return {'attribute': target, 'op': op, 'channel': channel, 'magnitude': {
        'type': 1, 'scalable': None, 'custom': None,
        'attributeBased': {'coefficient': sf(1.0, coeff_row), 'pre': sf(0.0), 'post': sf(0.0),
                           'attribute': backing, 'attributeCurve': None, 'calcType': 0},
    }}


def evaluator(mods, rows=None, base=None):
    rows = {'SpellDamageAD': curve(190, 285, 470), 'SpellDamageAP': curve(20, 30, 45),
            'HealPercent': curve(0.12, 0.12, 0.12), 'Health': curve(1, 1.8, 3.24), **(rows or {})}
    return UnitEvaluator(FakeGame(rows), base or {'HealthMax': 1200.0}, mods, rows['Health'])


class EvaluatorTest(unittest.TestCase):
    def test_sums_ad_and_ap_scaling(self):
        ev = evaluator([
            attribute_mod('PhysicalDamageCalc1', 'AttackDamage', 'SpellDamageAD'),
            attribute_mod('PhysicalDamageCalc1', 'AbilityPower', 'SpellDamageAP'),
        ])
        self.assertEqual([ev.attribute('PhysicalDamageCalc1', s) for s in (1, 2, 3)], [210, 315, 515])

    def test_health_scales_per_star(self):
        ev = evaluator([attribute_mod('HealthCalc2', 'HealthMax', 'HealPercent')])
        self.assertEqual([round(ev.attribute('HealthCalc2', s), 2) for s in (1, 2, 3)], [144, 259.2, 466.56])

    def test_multiply_then_add_final(self):
        # Caitlyn: Calc3 = (Calc2 × Stack) + Calc1; Stack is 0 outside combat.
        ev = evaluator([
            attribute_mod('PhysicalDamageCalc1', 'AttackDamage', 'SpellDamageAD'),
            attribute_mod('PhysicalDamageCalc2', 'PhysicalDamageCalc1', None),
            attribute_mod('PhysicalDamageCalc3', 'PhysicalDamageCalc2', None),
            attribute_mod('PhysicalDamageCalc3', 'Stack', None, op=OP_MULTIPLY_ADDITIVE),
            attribute_mod('PhysicalDamageCalc3', 'PhysicalDamageCalc1', None, op=OP_ADD_FINAL),
        ])
        self.assertEqual(ev.attribute('PhysicalDamageCalc3', 1), 190)

    def test_override_wins_its_channel(self):
        ev = evaluator([
            attribute_mod('ManaCalc1', 'AbilityPower', 'SpellDamageAP'),
            attribute_mod('ManaCalc1', 'AbilityPower', 'SpellDamageAD', op=OP_OVERRIDE),
        ])
        self.assertEqual(ev.attribute('ManaCalc1', 1), 190)

    def test_channels_feed_forward(self):
        ev = evaluator([
            attribute_mod('GenericCalc1', 'AbilityPower', 'SpellDamageAP', channel=0),
            attribute_mod('GenericCalc1', 'HealthMax', 'HealPercent', op=OP_MULTIPLY_ADDITIVE, channel=1),
        ])
        # channel 0: 20; channel 1: × (1 + (144 − 1))
        self.assertEqual(ev.attribute('GenericCalc1', 1), 20 * 144)

    def test_unknown_attribute_is_unsupported(self):
        ev = evaluator([attribute_mod('GenericCalc1', 'SomeCombatState', None)])
        with self.assertRaises(Unsupported):
            ev.attribute('GenericCalc1', 1)

    def test_display_rounding(self):
        self.assertEqual(display_values([369, 534.2, 2466.56]), [369, 534, 2467])
        self.assertEqual(display_values([59.5, 89.25, 138.25]), [60, 89, 138])  # half-up, not banker's
        self.assertEqual(display_values([0.3, 0.3, 1]), [0.3, 0.3, 1])


class TooltipFormatTest(unittest.TestCase):
    def test_reads_format_hints_in_both_text_encodings(self):
        latin = b'\x00\x10Then gain <TFTCurveTable style="colorStat" row="SpellAS" format="percentMinusOne"/> AS, ' \
                b'<TFTCurveTable row="SpellDurability" format="p"/> Durability, <TFTCurveTable row="SpellDuration"/>s'
        wide = '<TFTAttribute attributeID="TFTCalculationAttributes.GenericCalc1" format="percent"/> é'.encode('utf-16le')
        self.assertEqual(tooltip_formats(latin + b'\x00' + wide), {
            'SpellAS': 'percentMinusOne', 'SpellDurability': 'percent', 'GenericCalc1': 'percent',
        })


if __name__ == '__main__':
    unittest.main()
