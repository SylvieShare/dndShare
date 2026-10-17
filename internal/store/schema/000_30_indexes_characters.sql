-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE INDEX concentration_effect_character ON dndshare.concentration_effect USING btree (target_char_id);

CREATE INDEX concentration_effect_encounter ON dndshare.concentration_effect USING btree (encounter_id);

CREATE INDEX idx_char_icon_image_id ON dndshare."char" USING btree (icon_image_id) WHERE (icon_image_id IS NOT NULL);

CREATE INDEX idx_char_source_version_id ON dndshare."char" USING btree (source_version_id);

CREATE INDEX idx_char_template_id ON dndshare."char" USING btree (template_id);

CREATE INDEX idx_char_user_changed ON dndshare."char" USING btree (user_id, changed_at DESC) WHERE (deleted = false);

CREATE INDEX idx_char_user_id ON dndshare."char" USING btree (user_id);
