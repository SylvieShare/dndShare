-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.session ALTER COLUMN id SET DEFAULT nextval('dndshare.session_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_arc ALTER COLUMN id SET DEFAULT nextval('dndshare.session_arc_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_chapter ALTER COLUMN id SET DEFAULT nextval('dndshare.session_chapter_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_chapter_edge ALTER COLUMN id SET DEFAULT nextval('dndshare.session_chapter_edge_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_encounter ALTER COLUMN id SET DEFAULT nextval('dndshare.encounter_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_event ALTER COLUMN id SET DEFAULT nextval('dndshare.session_event_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_location ALTER COLUMN id SET DEFAULT nextval('dndshare.session_location_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_material ALTER COLUMN id SET DEFAULT nextval('dndshare.session_material_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_music_state ALTER COLUMN id SET DEFAULT nextval('dndshare.session_music_state_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_npc ALTER COLUMN id SET DEFAULT nextval('dndshare.session_npc_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_occurrence ALTER COLUMN id SET DEFAULT nextval('dndshare.session_occurrence_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_participant ALTER COLUMN id SET DEFAULT nextval('dndshare.session_participant_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_quest ALTER COLUMN id SET DEFAULT nextval('dndshare.session_quest_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_scene ALTER COLUMN id SET DEFAULT nextval('dndshare.session_scene_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_scene_edge ALTER COLUMN id SET DEFAULT nextval('dndshare.session_scene_edge_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_scene_item ALTER COLUMN id SET DEFAULT nextval('dndshare.session_scene_item_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_scene_item_edge ALTER COLUMN id SET DEFAULT nextval('dndshare.session_scene_item_edge_id_seq'::regclass);

ALTER TABLE ONLY dndshare.session_timer ALTER COLUMN id SET DEFAULT nextval('dndshare.session_timer_id_seq'::regclass);
