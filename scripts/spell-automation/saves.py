"""Additional save clauses reviewed against the catalogue descriptions.

These saves are announced explicitly, because they may occur only on a failed
condition, on a later turn, or against an unwilling target. Fixed DCs and spells
with multiple different save abilities require the phase workflow in the audit.
"""
MANUAL_SAVES = {
    546: 'cha', 1004: 'cha', 705: 'con', 1214: 'cha', 572: 'cha',
    1343: 'cha', 732: 'wis', 1301: 'cha', 888: 'cha', 1303: 'dex',
    892: 'int', 1392: 'wis', 1137: 'dex', 1040: 'wis', 1396: 'con',
    1350: 'con', 748: 'wis', 749: 'con', 751: 'con', 605: 'con',
    608: 'wis', 1150: 'wis', 1239: 'wis', 627: 'dex', 925: 'dex',
    1314: 'cha', 942: 'wis', 651: 'wis', 1069: 'cha', 1179: 'cha',
    1075: 'con', 1076: 'cha', 1261: 'cha', 961: 'int', 1364: 'con',
    1182: 'str', 807: 'str', 1265: 'wis', 810: 'wis', 1193: 'cha',
    814: 'wis', 816: 'cha', 834: 'cha', 835: 'con', 1100: 'con',
    690: 'dex',
}
