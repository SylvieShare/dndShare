-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE INDEX idx_session_arc_session_id ON dndshare.session_arc USING btree (session_id, "order");

CREATE INDEX idx_session_chapter_arc_id ON dndshare.session_chapter USING btree (arc_id);

CREATE INDEX idx_session_chapter_edge_arc_id ON dndshare.session_chapter_edge USING btree (arc_id);

CREATE INDEX idx_session_chapter_image_id ON dndshare.session_chapter USING btree (image_id);

CREATE INDEX idx_session_chapter_session_id ON dndshare.session_chapter USING btree (session_id);

CREATE INDEX idx_session_current_chapter_id ON dndshare.session USING btree (current_chapter_id);

CREATE INDEX idx_session_encounter_session_id ON dndshare.session_encounter USING btree (session_id);

CREATE INDEX idx_session_entity_relation_right ON dndshare.session_entity_relation USING btree (session_id, right_type, right_id);

CREATE INDEX idx_session_event_actor_item ON dndshare.session_event USING btree (actor_item_id) WHERE (actor_item_id IS NOT NULL);

CREATE INDEX idx_session_event_author_user_id ON dndshare.session_event USING btree (author_user_id);

CREATE UNIQUE INDEX idx_session_event_client_action ON dndshare.session_event USING btree (session_id, client_action_id) WHERE (client_action_id IS NOT NULL);

CREATE INDEX idx_session_event_session_cursor ON dndshare.session_event USING btree (session_id, id);

CREATE INDEX idx_session_event_session_id ON dndshare.session_event USING btree (session_id);

CREATE INDEX idx_session_location_image_id ON dndshare.session_location USING btree (image_id);

CREATE INDEX idx_session_location_parent ON dndshare.session_location USING btree (parent_location_id);

CREATE INDEX idx_session_location_session_order ON dndshare.session_location USING btree (session_id, parent_location_id, sort_order, id);

CREATE INDEX idx_session_material_session_id ON dndshare.session_material USING btree (session_id);

CREATE INDEX idx_session_npc_bestiary_item ON dndshare.session_npc USING btree (bestiary_item_id) WHERE (bestiary_item_id IS NOT NULL);

CREATE INDEX idx_session_npc_image_id ON dndshare.session_npc USING btree (image_id);

CREATE INDEX idx_session_npc_session_order ON dndshare.session_npc USING btree (session_id, sort_order, id);

CREATE INDEX idx_session_owner_user_id ON dndshare.session USING btree (owner_user_id);

CREATE INDEX idx_session_participant_char_id ON dndshare.session_participant USING btree (char_id);

CREATE INDEX idx_session_participant_user_id ON dndshare.session_participant USING btree (user_id);

CREATE INDEX idx_session_quest_session_order ON dndshare.session_quest USING btree (session_id, sort_order, id);

CREATE INDEX idx_session_rules_edition ON dndshare.session USING btree (source_version_id);

CREATE INDEX idx_session_scene_chapter_id ON dndshare.session_scene USING btree (chapter_id);

CREATE INDEX idx_session_scene_edge_chapter_id ON dndshare.session_scene_edge USING btree (chapter_id);

CREATE INDEX idx_session_scene_image_id ON dndshare.session_scene USING btree (image_id);

CREATE INDEX idx_session_scene_item_edge_scene_id ON dndshare.session_scene_item_edge USING btree (scene_id);

CREATE INDEX idx_session_scene_item_material_id ON dndshare.session_scene_item USING btree (material_id) WHERE (material_id IS NOT NULL);

CREATE INDEX idx_session_scene_item_scene_id ON dndshare.session_scene_item USING btree (scene_id);

CREATE INDEX idx_session_scene_location_id ON dndshare.session_scene USING btree (location_id) WHERE (location_id IS NOT NULL);

CREATE INDEX idx_session_system_id ON dndshare.session USING btree (system_id);

CREATE INDEX idx_session_timer_session_id ON dndshare.session_timer USING btree (session_id, id);

CREATE UNIQUE INDEX session_chapter_edge_unordered_pair_key ON dndshare.session_chapter_edge USING btree (LEAST(from_chapter_id, to_chapter_id), GREATEST(from_chapter_id, to_chapter_id));

CREATE UNIQUE INDEX session_interaction_pending_round ON dndshare.session_interaction USING btree (session_id, LEAST(sender_char_id, recipient_char_id), GREATEST(sender_char_id, recipient_char_id)) WHERE ((kind = 'rps_challenge'::text) AND (status = ANY (ARRAY['pending'::text, 'choosing'::text])));

CREATE INDEX session_interaction_recipient ON dndshare.session_interaction USING btree (session_id, recipient_char_id, event_id DESC);

CREATE INDEX session_interaction_sender ON dndshare.session_interaction USING btree (session_id, sender_char_id, event_id DESC);

CREATE INDEX session_inventory_available ON dndshare.session_inventory USING btree (session_id) WHERE available;

CREATE UNIQUE INDEX session_inventory_slot ON dndshare.session_inventory USING btree (session_id, slot) WHERE available;

CREATE INDEX session_occurrence_schedule ON dndshare.session_occurrence USING btree (session_id, scheduled_on, number);

CREATE UNIQUE INDEX session_scene_edge_unordered_pair_key ON dndshare.session_scene_edge USING btree (LEAST(from_scene_id, to_scene_id), GREATEST(from_scene_id, to_scene_id));

CREATE UNIQUE INDEX session_scene_item_edge_unordered_pair_key ON dndshare.session_scene_item_edge USING btree (LEAST(from_item_id, to_item_id), GREATEST(from_item_id, to_item_id));
