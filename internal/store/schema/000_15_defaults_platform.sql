-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.dictionary_text ALTER COLUMN id SET DEFAULT nextval('dndshare.dictionary_text_id_seq'::regclass);

ALTER TABLE ONLY dndshare.error_report ALTER COLUMN id SET DEFAULT nextval('dndshare.error_report_id_seq'::regclass);

ALTER TABLE ONLY dndshare.error_report_message ALTER COLUMN id SET DEFAULT nextval('dndshare.error_report_message_id_seq'::regclass);

ALTER TABLE ONLY dndshare.job_run ALTER COLUMN id SET DEFAULT nextval('dndshare.job_run_id_seq'::regclass);

ALTER TABLE ONLY dndshare.logs ALTER COLUMN id SET DEFAULT nextval('dndshare.logs_id_seq'::regclass);

ALTER TABLE ONLY dndshare.music_album ALTER COLUMN id SET DEFAULT nextval('dndshare.music_album_id_seq'::regclass);

ALTER TABLE ONLY dndshare.music_album_track ALTER COLUMN id SET DEFAULT nextval('dndshare.music_album_track_id_seq'::regclass);

ALTER TABLE ONLY dndshare.music_tag ALTER COLUMN id SET DEFAULT nextval('dndshare.music_tag_id_seq'::regclass);

ALTER TABLE ONLY dndshare.music_track ALTER COLUMN id SET DEFAULT nextval('dndshare.music_track_id_seq'::regclass);

ALTER TABLE ONLY dndshare.role ALTER COLUMN id SET DEFAULT nextval('dndshare.role_id_seq'::regclass);

ALTER TABLE ONLY dndshare.storage_image ALTER COLUMN id SET DEFAULT nextval('dndshare.storage_image_id_seq'::regclass);

ALTER TABLE ONLY dndshare.users ALTER COLUMN id SET DEFAULT nextval('dndshare.users_id_seq'::regclass);

ALTER TABLE ONLY dndshare.users_role ALTER COLUMN id SET DEFAULT nextval('dndshare.users_role_id_seq'::regclass);

ALTER TABLE ONLY dndshare.users_session ALTER COLUMN id SET DEFAULT nextval('dndshare.user_sessions_id_seq'::regclass);
