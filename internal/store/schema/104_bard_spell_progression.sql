-- PHB/SRD 2014 Bard: keep level-based known limits in the handbook.
-- Creation, the sheet and level-up all consume the same progression.
UPDATE dndshare.item
SET data = jsonb_set(data, '{spellcasting}',
  COALESCE(data -> 'spellcasting', '{}'::jsonb) || jsonb_build_object(
    'selection_mode', 'known',
    'known_progression', '[
      {"level":1,"cantrips":2,"spells":4},
      {"level":2,"cantrips":2,"spells":5},
      {"level":3,"cantrips":2,"spells":6},
      {"level":4,"cantrips":3,"spells":7},
      {"level":5,"cantrips":3,"spells":8},
      {"level":6,"cantrips":3,"spells":9},
      {"level":7,"cantrips":3,"spells":10},
      {"level":8,"cantrips":3,"spells":11},
      {"level":9,"cantrips":3,"spells":12},
      {"level":10,"cantrips":4,"spells":14},
      {"level":11,"cantrips":4,"spells":15},
      {"level":12,"cantrips":4,"spells":15},
      {"level":13,"cantrips":4,"spells":16},
      {"level":14,"cantrips":4,"spells":18},
      {"level":15,"cantrips":4,"spells":19},
      {"level":16,"cantrips":4,"spells":19},
      {"level":17,"cantrips":4,"spells":20},
      {"level":18,"cantrips":4,"spells":22},
      {"level":19,"cantrips":4,"spells":22},
      {"level":20,"cantrips":4,"spells":22}
    ]'::jsonb
  ), true)
WHERE id = 4016 AND type_id = 9 AND user_id IS NULL
  AND lower(name_en) = 'bard';
