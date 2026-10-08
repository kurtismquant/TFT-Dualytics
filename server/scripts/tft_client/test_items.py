"""Item tooltip text handling (synthetic strings)."""

import unittest

from items import split_texts

STATS = '<TFTCurveTable row="AttackDamage" icon="Icon.AD" type="stat" format="percent"/> ' \
        '<TFTCurveTable row="CriticalStrikeChance" icon="Icon.CritChance" type="stat" format="percent"/>'


class SplitTextsTest(unittest.TestCase):
    def test_stat_line_and_description(self):
        self.assertEqual(split_texts([STATS, 'Gain <Keyword>Precision</>.']), (STATS, 'Gain <Keyword>Precision</>.'))

    def test_inline_stat_tags_stay_in_the_description(self):
        desc = 'If riding the BFF, gain an additional <TFTCurveTable row="RiderArmorMR" icon="icon.Armor" type="stat"/>'
        self.assertEqual(split_texts([desc]), ('', desc))

    def test_skips_empty_texts_and_joins_extra_paragraphs(self):
        self.assertEqual(split_texts(['', 'First.', '  ', 'Second.']), ('', 'First.\r\n\r\nSecond.'))


if __name__ == '__main__':
    unittest.main()
