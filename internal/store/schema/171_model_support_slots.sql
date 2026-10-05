-- Add structural metadata without changing immutable meshes or existing map placements.
ALTER TABLE dndshare.map_model DROP CONSTRAINT map_model_tile_type_check;
ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_tile_type_check CHECK (tile_type IN ('floor','wall','prop','stairs','frame'));
UPDATE dndshare.map_model SET geometry=geometry || jsonb_build_object(
 'collectionName','Lost Cave','wallMode','center','supportSlots','[]'::jsonb,
 'wallMask',CASE source_code
  WHEN 'LC-001' THEN 17 WHEN 'LC-002' THEN 17 WHEN 'LC-003' THEN 65
  WHEN 'LC-004' THEN 21 WHEN 'LC-005' THEN 85 WHEN 'LC-006' THEN 1
  WHEN 'LC-012' THEN 17 WHEN 'LC-013' THEN 17 WHEN 'LC-014' THEN 65 WHEN 'LC-015' THEN 1 ELSE 0 END)
WHERE collection='lost-cave';
