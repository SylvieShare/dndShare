"""Catch an incomplete review-state contract before SDK/browser capture starts."""
import unittest

from report import MATRIX, validate_state_labels


class ReportLabelsTest(unittest.TestCase):
    def test_every_published_matrix_state_has_a_label(self):
        validate_state_labels(MATRIX)

    def test_an_unknown_state_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Missing review state labels: unknown-screen'):
            validate_state_labels({'states': ['sheet-inventory', 'unknown-screen']})

    def test_named_state_records_have_the_same_contract(self):
        validate_state_labels({'states': [{'name': 'sheet-inventory'}]})


if __name__ == '__main__':
    unittest.main()
