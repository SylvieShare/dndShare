-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.battle_map_model
    ADD CONSTRAINT battle_map_model_map_id_fkey FOREIGN KEY (map_id) REFERENCES dndshare.battle_map(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.battle_map_model
    ADD CONSTRAINT battle_map_model_model_id_fkey FOREIGN KEY (model_id) REFERENCES dndshare.map_model(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.battle_map
    ADD CONSTRAINT battle_map_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.battle_map_preview
    ADD CONSTRAINT battle_map_preview_map_id_fkey FOREIGN KEY (map_id) REFERENCES dndshare.battle_map(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.map_model
    ADD CONSTRAINT map_model_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES dndshare.map_model_definition(id);

ALTER TABLE ONLY dndshare.map_model_transition
    ADD CONSTRAINT map_model_transition_from_model_id_fkey FOREIGN KEY (from_model_id) REFERENCES dndshare.map_model_definition(id);

ALTER TABLE ONLY dndshare.map_model_transition
    ADD CONSTRAINT map_model_transition_to_model_id_fkey FOREIGN KEY (to_model_id) REFERENCES dndshare.map_model_definition(id);

ALTER TABLE ONLY dndshare.session_global_map
    ADD CONSTRAINT session_global_map_image_id_fkey FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id);

ALTER TABLE ONLY dndshare.session_global_map
    ADD CONSTRAINT session_global_map_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_map_display
    ADD CONSTRAINT session_map_display_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_map_display
    ADD CONSTRAINT session_map_display_session_id_map_id_fkey FOREIGN KEY (session_id, map_id) REFERENCES dndshare.session_map(session_id, id);

ALTER TABLE ONLY dndshare.session_map_model
    ADD CONSTRAINT session_map_model_map_id_fkey FOREIGN KEY (map_id) REFERENCES dndshare.session_map(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_map_model
    ADD CONSTRAINT session_map_model_model_id_fkey FOREIGN KEY (model_id) REFERENCES dndshare.map_model(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_map
    ADD CONSTRAINT session_map_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;
