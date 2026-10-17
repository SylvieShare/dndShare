-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare."char" ALTER COLUMN id SET DEFAULT nextval('dndshare.char_id_seq'::regclass);
