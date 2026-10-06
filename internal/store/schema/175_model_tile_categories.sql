-- One category defines the tile kind and wall shape. Collection identifies the pack.
ALTER TABLE dndshare.map_model DROP CONSTRAINT map_model_tile_type_check;

UPDATE dndshare.map_model SET tile_type = 'wall-' || CASE
    WHEN wall_layout IN ('straight','angle','tee','cross','corner') THEN wall_layout
    ELSE 'custom'
END WHERE tile_type = 'wall';

UPDATE dndshare.map_model SET geometry = geometry - 'terrainType' - 'wallLayout' - 'tileType';

ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_tile_type_check CHECK (
    tile_type IN ('floor','wall-straight','wall-angle','wall-tee','wall-cross',
                 'wall-corner','wall-custom','stairs','frame','prop')
);
DROP INDEX dndshare.map_model_filter;
ALTER TABLE dndshare.map_model DROP COLUMN terrain_type, DROP COLUMN wall_layout;
CREATE INDEX map_model_filter ON dndshare.map_model(collection, tile_type);
