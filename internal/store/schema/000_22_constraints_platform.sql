-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.error_report_automation_lock
    ADD CONSTRAINT error_report_automation_lock_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.error_report_message
    ADD CONSTRAINT error_report_message_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.error_report
    ADD CONSTRAINT error_report_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.job_run
    ADD CONSTRAINT job_run_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.logs
    ADD CONSTRAINT logs_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.music_album
    ADD CONSTRAINT music_album_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.music_album
    ADD CONSTRAINT music_album_system_key_key UNIQUE (system_key);

ALTER TABLE ONLY dndshare.music_album_track
    ADD CONSTRAINT music_album_track_album_id_track_id_key UNIQUE (album_id, track_id);

ALTER TABLE ONLY dndshare.music_album_track
    ADD CONSTRAINT music_album_track_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.music_tag
    ADD CONSTRAINT music_tag_owner_user_id_name_key UNIQUE (owner_user_id, name);

ALTER TABLE ONLY dndshare.music_tag
    ADD CONSTRAINT music_tag_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.music_track
    ADD CONSTRAINT music_track_pkey PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.music_track
    ADD CONSTRAINT music_track_system_key_key UNIQUE (system_key);

ALTER TABLE ONLY dndshare.music_track_tag
    ADD CONSTRAINT music_track_tag_pkey PRIMARY KEY (track_id, tag_id);

ALTER TABLE ONLY dndshare.music_track
    ADD CONSTRAINT music_track_uuid_key UNIQUE (uuid);

ALTER TABLE ONLY dndshare.role
    ADD CONSTRAINT role_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.storage_image
    ADD CONSTRAINT storage_image_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.users_session
    ADD CONSTRAINT user_sessions_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.user_tutorial
    ADD CONSTRAINT user_tutorial_pkey PRIMARY KEY (user_id, flow_id, source_key, device);

ALTER TABLE ONLY dndshare.users
    ADD CONSTRAINT users_pk PRIMARY KEY (id);

ALTER TABLE ONLY dndshare.users_role
    ADD CONSTRAINT users_role_pk PRIMARY KEY (id);
