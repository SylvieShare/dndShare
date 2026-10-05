-- Occupied cells follow the mounting base, not decorative overhangs. GLBs keep
-- their full geometry and original bounding-box origin; placementOffset aligns
-- that origin with the mounting base before the tile rotation is applied.
UPDATE dndshare.map_model SET geometry=geometry || '{"placementOffset":[0,0]}'::jsonb;

WITH corrections(code, name, source_sha, dx, dz) AS (VALUES
 ('UD-020','Bridge Broken','3b57182c376031caf90ef245cafe60084f34f3ddaf4d06b3bb80bce3f5637400',-0.000143::numeric,-0.154701::numeric),
 ('UD-078','Arch','2786640b732ac41ccfe07e37b7a0c40ba6b88c54e0d2e6b0dda42a9aaeb9977b',0.002601::numeric,0.246171::numeric)
)
UPDATE dndshare.map_model model
SET geometry=model.geometry || jsonb_build_object(
 'width',1,'height',1,'placementOffset',jsonb_build_array(corrections.dx,corrections.dz),
 'blockers',COALESCE((
  SELECT jsonb_agg((
   SELECT jsonb_agg(jsonb_build_array(
    greatest(0,least(1,(point->>0)::numeric+corrections.dx)),
    greatest(0,least(1,(point->>1)::numeric-0.5+corrections.dz))
   ) ORDER BY vertex_index)
   FROM jsonb_array_elements(polygon) WITH ORDINALITY AS vertices(point,vertex_index)
  ) ORDER BY polygon_index)
  FROM jsonb_array_elements(model.geometry->'blockers') WITH ORDINALITY AS polygons(polygon,polygon_index)
 ),'[]'::jsonb)
)
FROM corrections
WHERE model.collection='ultimate-dungeon'
 AND model.source_code=corrections.code AND model.source_name=corrections.name
 AND model.assets->'source'->>'sha256'=corrections.source_sha;

ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_placement_offset_valid CHECK (COALESCE(
 jsonb_typeof(geometry->'placementOffset')='array'
 AND jsonb_array_length(geometry->'placementOffset')=2
 AND jsonb_typeof(geometry->'placementOffset'->0)='number'
 AND jsonb_typeof(geometry->'placementOffset'->1)='number'
 AND abs((geometry->'placementOffset'->>0)::numeric)<=8
 AND abs((geometry->'placementOffset'->>1)::numeric)<=8,false
));
