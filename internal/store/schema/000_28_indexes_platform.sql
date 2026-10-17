-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE INDEX i_users_session ON dndshare.users_session USING btree (user_id, session);

CREATE INDEX idx_error_report_approved_created_at ON dndshare.error_report USING btree (created_at DESC) WHERE approved;

CREATE INDEX idx_error_report_created_at ON dndshare.error_report USING btree (created_at DESC);

CREATE INDEX idx_error_report_message_report_id_id ON dndshare.error_report_message USING btree (error_report_id, id);

CREATE INDEX idx_error_report_open_approved_created_at ON dndshare.error_report USING btree (created_at DESC) WHERE (approved AND ((status)::text = 'OPEN'::text));

CREATE INDEX idx_error_report_processing_expires_at ON dndshare.error_report USING btree (processing_expires_at) WHERE ((status)::text = 'IN_PROGRESS'::text);

CREATE INDEX idx_error_report_resolved_at ON dndshare.error_report USING btree (resolved_at) WHERE ((status)::text = 'RESOLVED'::text);

CREATE INDEX idx_error_report_serious_change_approved_by_user_id ON dndshare.error_report USING btree (serious_change_approved_by_user_id) WHERE (serious_change_approved_by_user_id IS NOT NULL);

CREATE INDEX idx_error_report_user_id ON dndshare.error_report USING btree (user_id);

CREATE INDEX idx_job_run_started_at ON dndshare.job_run USING btree (started_at DESC);

CREATE INDEX idx_job_run_started_by_user_id ON dndshare.job_run USING btree (started_by_user_id);

CREATE INDEX idx_job_run_status_running ON dndshare.job_run USING btree (status) WHERE ((status)::text = 'RUNNING'::text);

CREATE INDEX idx_logs_created_at ON dndshare.logs USING btree (created_at DESC);

CREATE UNIQUE INDEX idx_storage_image_session_system_key ON dndshare.storage_image USING btree (key) WHERE ((type)::text = 'session-image'::text);

CREATE UNIQUE INDEX idx_storage_image_static_status_effect_media_key ON dndshare.storage_image USING btree (key) WHERE ((user_id IS NULL) AND ((key)::text ~~ 'static-status-effect-media/%'::text));

CREATE UNIQUE INDEX idx_storage_image_system_class_key ON dndshare.storage_image USING btree (key) WHERE (((type)::text = 'item_icon'::text) AND (user_id IS NULL) AND ((key)::text ~~ 'system-class-images/%'::text));

CREATE UNIQUE INDEX idx_storage_image_system_item_media_key ON dndshare.storage_image USING btree (key) WHERE ((user_id IS NULL) AND ((key)::text ~~ 'system-item-media/%'::text));

CREATE UNIQUE INDEX idx_storage_image_system_race_key ON dndshare.storage_image USING btree (key) WHERE ((user_id IS NULL) AND ((key)::text ~~ 'system-race-images/%'::text));

CREATE INDEX idx_storage_image_user_created ON dndshare.storage_image USING btree (user_id, created_at DESC) WHERE ((user_id IS NOT NULL) AND (deleted = false));

CREATE INDEX idx_storage_image_user_id ON dndshare.storage_image USING btree (user_id);

CREATE INDEX idx_users_role_role_id ON dndshare.users_role USING btree (role_id);

CREATE INDEX idx_users_session_created_at ON dndshare.users_session USING btree (created_at);

CREATE INDEX idx_users_source_version_id ON dndshare.users USING btree (source_version_id);

CREATE INDEX music_album_owner_idx ON dndshare.music_album USING btree (owner_user_id);

CREATE INDEX music_album_track_album_idx ON dndshare.music_album_track USING btree (album_id, "position");

CREATE INDEX music_album_track_track_idx ON dndshare.music_album_track USING btree (track_id);

CREATE INDEX music_track_owner_idx ON dndshare.music_track USING btree (owner_user_id);

CREATE INDEX music_track_tag_tag_idx ON dndshare.music_track_tag USING btree (tag_id);

CREATE UNIQUE INDEX storage_image_system_item_type_icon_key ON dndshare.storage_image USING btree (key) WHERE ((user_id IS NULL) AND ((type)::text = 'item_type_icon'::text) AND (key IS NOT NULL));

CREATE UNIQUE INDEX users_login_uindex ON dndshare.users USING btree (login);

CREATE INDEX users_role_user_id_index ON dndshare.users_role USING btree (user_id);

CREATE UNIQUE INDEX users_session_token_uindex ON dndshare.users_session USING btree (session);
