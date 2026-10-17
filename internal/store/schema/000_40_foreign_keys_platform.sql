-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.error_report_message
    ADD CONSTRAINT error_report_message_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES dndshare.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.error_report_message
    ADD CONSTRAINT error_report_message_error_report_id_fkey FOREIGN KEY (error_report_id) REFERENCES dndshare.error_report(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.error_report
    ADD CONSTRAINT error_report_serious_change_approved_by_fk FOREIGN KEY (serious_change_approved_by_user_id) REFERENCES dndshare.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.error_report
    ADD CONSTRAINT error_report_user_id_fkey FOREIGN KEY (user_id) REFERENCES dndshare.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.job_run
    ADD CONSTRAINT fk_job_run_started_by_user_id FOREIGN KEY (started_by_user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.music_album
    ADD CONSTRAINT fk_music_album_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.music_tag
    ADD CONSTRAINT fk_music_tag_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.music_track
    ADD CONSTRAINT fk_music_track_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.storage_image
    ADD CONSTRAINT fk_storage_image_user_id FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.users_role
    ADD CONSTRAINT fk_users_role_role_id FOREIGN KEY (role_id) REFERENCES dndshare.role(id);

ALTER TABLE ONLY dndshare.users_role
    ADD CONSTRAINT fk_users_role_user_id FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.users_session
    ADD CONSTRAINT fk_users_session_user_id FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.music_album_track
    ADD CONSTRAINT music_album_track_album_id_fkey FOREIGN KEY (album_id) REFERENCES dndshare.music_album(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.music_album_track
    ADD CONSTRAINT music_album_track_track_id_fkey FOREIGN KEY (track_id) REFERENCES dndshare.music_track(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.music_track_tag
    ADD CONSTRAINT music_track_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES dndshare.music_tag(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.music_track_tag
    ADD CONSTRAINT music_track_tag_track_id_fkey FOREIGN KEY (track_id) REFERENCES dndshare.music_track(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.user_tutorial
    ADD CONSTRAINT user_tutorial_user_id_fkey FOREIGN KEY (user_id) REFERENCES dndshare.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.users
    ADD CONSTRAINT users_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES dndshare.source_version(id);
