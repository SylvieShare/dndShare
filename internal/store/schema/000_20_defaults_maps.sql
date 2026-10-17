-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.battle_map_preview ALTER COLUMN id SET DEFAULT nextval('dndshare.battle_map_preview_id_seq'::regclass);
