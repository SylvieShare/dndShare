ALTER TABLE dndshare.map_model DROP CONSTRAINT map_model_tile_type_check;
UPDATE dndshare.map_model SET geometry = geometry || jsonb_build_object(
 'hasDecor', tile_type='prop' OR source_name ~* '(skulls|bones|mushroom|crystal|chains|bags|barrel|weapons|debris|broken)',
 'hidden', collection='ultimate-dungeon' AND source_code IN ('UD-104','UD-108','UD-092'),
 'canStand', false, 'placementPoints', '[]'::jsonb
);
UPDATE dndshare.map_model SET tile_type=CASE
 WHEN source_name ~* 'bridge' THEN 'bridge'
 WHEN source_name ~* '(door|passage|archway|entrance|gate)' THEN 'passage'
 WHEN source_name ~* '(column|pillar)' THEN 'column'
 WHEN tile_type='prop' THEN 'floor'
 ELSE tile_type END;
UPDATE dndshare.map_model SET geometry=geometry || jsonb_build_object(
 'canStand', true,
 'placementPoints', (SELECT jsonb_agg(jsonb_build_object('x',x+.5,'y',y+.5,
   'elevation',(geometry->>'surfaceHeight')::numeric) ORDER BY y,x)
 FROM generate_series(0,(geometry->>'width')::int-1) x
 CROSS JOIN generate_series(0,(geometry->>'height')::int-1) y)
)
WHERE tile_type IN ('floor','bridge','stairs','passage') AND NOT (geometry->>'hidden')::boolean;
ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_tile_type_check CHECK (
 tile_type IN ('floor','wall-straight','wall-angle','wall-tee','wall-cross','wall-end',
 'wall-corner','wall-diagonal','stairs','frame','bridge','passage','column','object')
);
ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_surface_metadata_check CHECK (
 jsonb_typeof(geometry->'hasDecor')='boolean' AND jsonb_typeof(geometry->'canStand')='boolean'
 AND jsonb_typeof(geometry->'hidden')='boolean' AND jsonb_typeof(geometry->'placementPoints')='array'
);
