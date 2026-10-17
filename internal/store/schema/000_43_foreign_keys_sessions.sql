-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.session_encounter
    ADD CONSTRAINT encounter_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.session_event
    ADD CONSTRAINT fk_session_event_author_user_id FOREIGN KEY (author_user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT fk_session_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.session_participant
    ADD CONSTRAINT fk_session_participant_user_id FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.session_arc
    ADD CONSTRAINT session_arc_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_chapter
    ADD CONSTRAINT session_chapter_arc_fk FOREIGN KEY (arc_id) REFERENCES dndshare.session_arc(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_chapter_edge
    ADD CONSTRAINT session_chapter_edge_arc_id_fkey FOREIGN KEY (arc_id) REFERENCES dndshare.session_arc(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_chapter_edge
    ADD CONSTRAINT session_chapter_edge_from_chapter_id_fkey FOREIGN KEY (from_chapter_id) REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_chapter_edge
    ADD CONSTRAINT session_chapter_edge_to_chapter_id_fkey FOREIGN KEY (to_chapter_id) REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_chapter
    ADD CONSTRAINT session_chapter_image_fk FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_chapter
    ADD CONSTRAINT session_chapter_session_fk FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.session_d20_roll
    ADD CONSTRAINT session_d20_roll_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_entity_relation
    ADD CONSTRAINT session_entity_relation_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_event
    ADD CONSTRAINT session_event_actor_char_id_fkey FOREIGN KEY (actor_char_id) REFERENCES dndshare."char"(id);

ALTER TABLE ONLY dndshare.session_event
    ADD CONSTRAINT session_event_actor_item_id_fkey FOREIGN KEY (actor_item_id) REFERENCES dndshare.item(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.session_event
    ADD CONSTRAINT session_event_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.session_image_catalog
    ADD CONSTRAINT session_image_catalog_image_id_fkey FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_interaction
    ADD CONSTRAINT session_interaction_event_id_fkey FOREIGN KEY (event_id) REFERENCES dndshare.session_event(id);

ALTER TABLE ONLY dndshare.session_interaction
    ADD CONSTRAINT session_interaction_recipient_char_id_fkey FOREIGN KEY (recipient_char_id) REFERENCES dndshare."char"(id);

ALTER TABLE ONLY dndshare.session_interaction
    ADD CONSTRAINT session_interaction_sender_char_id_fkey FOREIGN KEY (sender_char_id) REFERENCES dndshare."char"(id);

ALTER TABLE ONLY dndshare.session_interaction
    ADD CONSTRAINT session_interaction_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.session_inventory
    ADD CONSTRAINT session_inventory_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.session_karmic_scale
    ADD CONSTRAINT session_karmic_scale_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_location
    ADD CONSTRAINT session_location_image_fk FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_location
    ADD CONSTRAINT session_location_parent_location_id_fkey FOREIGN KEY (parent_location_id) REFERENCES dndshare.session_location(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_location
    ADD CONSTRAINT session_location_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_material
    ADD CONSTRAINT session_material_image_id_fkey FOREIGN KEY (asset_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_material
    ADD CONSTRAINT session_material_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_music_state
    ADD CONSTRAINT session_music_state_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.session_npc
    ADD CONSTRAINT session_npc_bestiary_item_id_fkey FOREIGN KEY (bestiary_item_id) REFERENCES dndshare.item(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.session_npc
    ADD CONSTRAINT session_npc_image_fk FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_npc
    ADD CONSTRAINT session_npc_race_item_id_fkey FOREIGN KEY (race_item_id) REFERENCES dndshare.item(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.session_npc
    ADD CONSTRAINT session_npc_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_occurrence
    ADD CONSTRAINT session_occurrence_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_participant
    ADD CONSTRAINT session_participant_char_id_fkey FOREIGN KEY (char_id) REFERENCES dndshare."char"(id);

ALTER TABLE ONLY dndshare.session_participant
    ADD CONSTRAINT session_participant_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.session_presentation_state
    ADD CONSTRAINT session_presentation_state_material_id_fkey FOREIGN KEY (material_id) REFERENCES dndshare.session_material(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.session_presentation_state
    ADD CONSTRAINT session_presentation_state_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_quest
    ADD CONSTRAINT session_quest_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_scene_edge
    ADD CONSTRAINT session_scene_edge_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_scene_edge
    ADD CONSTRAINT session_scene_edge_from_scene_id_fkey FOREIGN KEY (from_scene_id) REFERENCES dndshare.session_scene(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_scene_edge
    ADD CONSTRAINT session_scene_edge_to_scene_id_fkey FOREIGN KEY (to_scene_id) REFERENCES dndshare.session_scene(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_scene
    ADD CONSTRAINT session_scene_image_fk FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_scene_item_edge
    ADD CONSTRAINT session_scene_item_edge_from_item_id_fkey FOREIGN KEY (from_item_id) REFERENCES dndshare.session_scene_item(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_scene_item_edge
    ADD CONSTRAINT session_scene_item_edge_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES dndshare.session_scene(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_scene_item_edge
    ADD CONSTRAINT session_scene_item_edge_to_item_id_fkey FOREIGN KEY (to_item_id) REFERENCES dndshare.session_scene_item(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.session_scene_item
    ADD CONSTRAINT session_scene_item_material_fk FOREIGN KEY (material_id) REFERENCES dndshare.session_material(id) ON DELETE RESTRICT;

ALTER TABLE ONLY dndshare.session_scene_item
    ADD CONSTRAINT session_scene_item_session_scene_fk FOREIGN KEY (scene_id) REFERENCES dndshare.session_scene(id);

ALTER TABLE ONLY dndshare.session_scene
    ADD CONSTRAINT session_scene_location_fk FOREIGN KEY (location_id) REFERENCES dndshare.session_location(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.session_scene
    ADD CONSTRAINT session_scene_session_chapter_fk FOREIGN KEY (chapter_id) REFERENCES dndshare.session_chapter(id);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT session_session_chapter_fk FOREIGN KEY (current_chapter_id) REFERENCES dndshare.session_chapter(id);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT session_source_fk FOREIGN KEY (system_id) REFERENCES dndshare.source(id);

ALTER TABLE ONLY dndshare.session
    ADD CONSTRAINT session_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES dndshare.source_version(id);

ALTER TABLE ONLY dndshare.session_timer
    ADD CONSTRAINT session_timer_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id) ON DELETE CASCADE;
