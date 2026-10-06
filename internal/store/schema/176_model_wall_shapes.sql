-- Keep all model UUIDs/assets while separating inner angles, outside corners and ends.
ALTER TABLE dndshare.map_model DROP CONSTRAINT map_model_tile_type_check;
UPDATE dndshare.map_model SET tile_type = CASE
    WHEN tile_type = 'wall-corner' THEN 'wall-end'
    WHEN source_name ~* 'diagonal' THEN 'wall-diagonal'
    WHEN source_name ~* 'corner' THEN 'wall-corner'
    WHEN source_name ~* 'angle' THEN 'wall-angle'
    WHEN source_name ~* 't-shaped' THEN 'wall-tee'
    WHEN source_name ~* 'x-shaped' THEN 'wall-cross'
    WHEN source_name ~* '\m(end|ending|cap)\M' THEN 'wall-end'
    WHEN tile_type = 'wall-custom' THEN 'wall-straight'
    ELSE tile_type
END WHERE tile_type LIKE 'wall-%';
ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_tile_type_check CHECK (
    tile_type IN ('floor','wall-straight','wall-angle','wall-tee','wall-cross',
                 'wall-end','wall-corner','wall-diagonal','stairs','frame','prop')
);
