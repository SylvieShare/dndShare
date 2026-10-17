-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

ALTER TABLE ONLY dndshare.content_source_compatibility
    ADD CONSTRAINT content_source_compatibility_content_source_id_fkey FOREIGN KEY (content_source_id) REFERENCES dndshare.content_source(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.content_source_compatibility
    ADD CONSTRAINT content_source_compatibility_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES dndshare.source_version(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.content_source
    ADD CONSTRAINT content_source_native_source_version_id_fkey FOREIGN KEY (native_source_version_id) REFERENCES dndshare.source_version(id);

ALTER TABLE ONLY dndshare.content_source
    ADD CONSTRAINT content_source_source_id_fkey FOREIGN KEY (source_id) REFERENCES dndshare.source(id);

ALTER TABLE ONLY dndshare.custom_item_source
    ADD CONSTRAINT custom_item_source_user_id_fkey FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT fk_item_parent_id FOREIGN KEY (parent_id) REFERENCES dndshare.item(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT fk_item_type_id FOREIGN KEY (type_id) REFERENCES dndshare.item_type(id);

ALTER TABLE ONLY dndshare.item_type
    ADD CONSTRAINT fk_item_type_source_id FOREIGN KEY (source_id) REFERENCES dndshare.source(id);

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT fk_item_user_id FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.suggest
    ADD CONSTRAINT fk_suggest_svg_id FOREIGN KEY (svg_id) REFERENCES dndshare.svg_storage(id);

ALTER TABLE ONLY dndshare.suggest
    ADD CONSTRAINT fk_suggest_type_id FOREIGN KEY (type_id) REFERENCES dndshare.suggest_type(id);

ALTER TABLE ONLY dndshare.suggest_type
    ADD CONSTRAINT fk_suggest_type_source_id FOREIGN KEY (source_id) REFERENCES dndshare.source(id);

ALTER TABLE ONLY dndshare.suggest_type
    ADD CONSTRAINT fk_suggest_type_svg_id FOREIGN KEY (svg_id) REFERENCES dndshare.svg_storage(id);

ALTER TABLE ONLY dndshare.suggest
    ADD CONSTRAINT fk_suggest_user_id FOREIGN KEY (user_id) REFERENCES dndshare.users(id);

ALTER TABLE ONLY dndshare.item_content_source
    ADD CONSTRAINT item_content_source_content_source_id_fkey FOREIGN KEY (content_source_id) REFERENCES dndshare.content_source(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.item_content_source
    ADD CONSTRAINT item_content_source_item_id_fkey FOREIGN KEY (item_id) REFERENCES dndshare.item(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT item_cover_image_id_fkey FOREIGN KEY (cover_image_id) REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT item_custom_source_owner_fk FOREIGN KEY (custom_source_id, user_id) REFERENCES dndshare.custom_item_source(id, user_id);

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT item_derived_from_item_id_fkey FOREIGN KEY (derived_from_item_id) REFERENCES dndshare.item(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item
    ADD CONSTRAINT item_icon_image_id_fkey FOREIGN KEY (icon_image_id) REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item_icon_preset
    ADD CONSTRAINT item_icon_preset_image_id_fkey FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id);

ALTER TABLE ONLY dndshare.item_icon_preset
    ADD CONSTRAINT item_icon_preset_item_type_id_fkey FOREIGN KEY (item_type_id) REFERENCES dndshare.item_type(id);

ALTER TABLE ONLY dndshare.item_transfer
    ADD CONSTRAINT item_transfer_event_id_fkey FOREIGN KEY (event_id) REFERENCES dndshare.session_event(id);

ALTER TABLE ONLY dndshare.item_transfer
    ADD CONSTRAINT item_transfer_recipient_char_id_fkey FOREIGN KEY (recipient_char_id) REFERENCES dndshare."char"(id);

ALTER TABLE ONLY dndshare.item_transfer
    ADD CONSTRAINT item_transfer_sender_char_id_fkey FOREIGN KEY (sender_char_id) REFERENCES dndshare."char"(id);

ALTER TABLE ONLY dndshare.item_transfer
    ADD CONSTRAINT item_transfer_session_id_fkey FOREIGN KEY (session_id) REFERENCES dndshare.session(id);

ALTER TABLE ONLY dndshare.item_type
    ADD CONSTRAINT item_type_cover_image_id_fkey FOREIGN KEY (cover_image_id) REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item_type
    ADD CONSTRAINT item_type_icon_image_id_fkey FOREIGN KEY (icon_image_id) REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item_type
    ADD CONSTRAINT item_type_parent_type_id_fkey FOREIGN KEY (parent_type_id) REFERENCES dndshare.item_type(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item_version_compatibility
    ADD CONSTRAINT item_version_compatibility_item_id_fkey FOREIGN KEY (item_id) REFERENCES dndshare.item(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.item_version_compatibility
    ADD CONSTRAINT item_version_compatibility_replaced_by_item_id_fkey FOREIGN KEY (replaced_by_item_id) REFERENCES dndshare.item(id) ON DELETE SET NULL;

ALTER TABLE ONLY dndshare.item_version_compatibility
    ADD CONSTRAINT item_version_compatibility_source_version_id_fkey FOREIGN KEY (source_version_id) REFERENCES dndshare.source_version(id) ON DELETE CASCADE;

ALTER TABLE ONLY dndshare.source_version
    ADD CONSTRAINT source_version_source_id_fkey FOREIGN KEY (source_id) REFERENCES dndshare.source(id);

ALTER TABLE ONLY dndshare.suggest
    ADD CONSTRAINT suggest_icon_image_id_fkey FOREIGN KEY (icon_image_id) REFERENCES dndshare.storage_image(id);

ALTER TABLE ONLY dndshare.svg_storage
    ADD CONSTRAINT svg_storage_user_id_fkey FOREIGN KEY (user_id) REFERENCES dndshare.users(id);
