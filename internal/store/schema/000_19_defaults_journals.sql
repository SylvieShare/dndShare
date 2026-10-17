-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.journal ALTER COLUMN id SET DEFAULT nextval('dndshare.journal_id_seq'::regclass);

ALTER TABLE ONLY dndshare.journal_entry ALTER COLUMN id SET DEFAULT nextval('dndshare.journal_entry_id_seq'::regclass);

ALTER TABLE ONLY dndshare.journal_section ALTER COLUMN id SET DEFAULT nextval('dndshare.journal_section_id_seq'::regclass);
