-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE INDEX battle_map_owner ON dndshare.battle_map USING btree (owner_user_id);

CREATE INDEX map_model_definition_group ON dndshare.map_model_definition USING btree (collection, code);

CREATE INDEX map_model_filter ON dndshare.map_model USING btree (collection, tile_type);

CREATE UNIQUE INDEX session_global_map_current_idx ON dndshare.session_global_map USING btree (session_id) WHERE is_current;

CREATE INDEX session_global_map_image_idx ON dndshare.session_global_map USING btree (image_id);

CREATE INDEX session_global_map_session_idx ON dndshare.session_global_map USING btree (session_id);

CREATE INDEX session_map_session ON dndshare.session_map USING btree (session_id);
