-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.content_source ALTER COLUMN id SET DEFAULT nextval('dndshare.content_source_id_seq'::regclass);

ALTER TABLE ONLY dndshare.custom_item_source ALTER COLUMN id SET DEFAULT nextval('dndshare.custom_item_source_id_seq'::regclass);

ALTER TABLE ONLY dndshare.item ALTER COLUMN id SET DEFAULT nextval('dndshare.item_id_seq'::regclass);

ALTER TABLE ONLY dndshare.item_icon_preset ALTER COLUMN id SET DEFAULT nextval('dndshare.item_icon_preset_id_seq'::regclass);

ALTER TABLE ONLY dndshare.item_transfer ALTER COLUMN id SET DEFAULT nextval('dndshare.item_transfer_id_seq'::regclass);

ALTER TABLE ONLY dndshare.item_type ALTER COLUMN id SET DEFAULT nextval('dndshare.item_type_id_seq'::regclass);

ALTER TABLE ONLY dndshare.source ALTER COLUMN id SET DEFAULT nextval('dndshare.source_id_seq'::regclass);

ALTER TABLE ONLY dndshare.source_version ALTER COLUMN id SET DEFAULT nextval('dndshare.source_version_id_seq'::regclass);

ALTER TABLE ONLY dndshare.suggest_type ALTER COLUMN id SET DEFAULT nextval('dndshare.suggest_type_id_seq'::regclass);

ALTER TABLE ONLY dndshare.svg_storage ALTER COLUMN id SET DEFAULT nextval('dndshare.svg_storage_id_seq'::regclass);
