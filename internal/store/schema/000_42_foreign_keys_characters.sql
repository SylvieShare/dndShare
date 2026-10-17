-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare."char"
    ADD CONSTRAINT char_char_template_fk FOREIGN KEY (template_id) REFERENCES dndshare.char_template(id);

ALTER TABLE ONLY dndshare."char"
    ADD CONSTRAINT char_cloned_from_char_id_fkey FOREIGN KEY (cloned_from_char_id) REFERENCES dndshare."char"(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare."char"
    ADD CONSTRAINT char_icon_image_id_fkey FOREIGN KEY (icon_image_id) REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare."char"
    ADD CONSTRAINT char_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES dndshare.source_version(id);

ALTER TABLE ONLY dndshare.character_concentration
    ADD CONSTRAINT character_concentration_char_id_fkey FOREIGN KEY (char_id) REFERENCES dndshare."char"(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.character_concentration
    ADD CONSTRAINT character_concentration_spell_id_fkey FOREIGN KEY (spell_id) REFERENCES dndshare.item(id);

ALTER TABLE ONLY dndshare.concentration_effect
    ADD CONSTRAINT concentration_effect_cast_id_fkey FOREIGN KEY (cast_id) REFERENCES dndshare.character_concentration(cast_id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.concentration_effect
    ADD CONSTRAINT concentration_effect_effect_id_fkey FOREIGN KEY (effect_id) REFERENCES dndshare.item(id);

ALTER TABLE ONLY dndshare.concentration_effect
    ADD CONSTRAINT concentration_effect_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES dndshare.session_encounter(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.concentration_effect
    ADD CONSTRAINT concentration_effect_target_char_id_fkey FOREIGN KEY (target_char_id) REFERENCES dndshare."char"(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare."char"
    ADD CONSTRAINT fk_char_user_id FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.item_application
    ADD CONSTRAINT item_application_char_id_fkey FOREIGN KEY (char_id) REFERENCES dndshare."char"(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.spell_cast_receipt
    ADD CONSTRAINT spell_cast_receipt_char_id_fkey FOREIGN KEY (char_id) REFERENCES dndshare."char"(id) ON DELETE CASCADE;
