-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE UNIQUE INDEX content_source_system_edition_code_key ON dndshare.content_source USING btree (source_id, COALESCE(native_source_version_id, (0)::bigint), upper(btrim((code)::text)));

CREATE UNIQUE INDEX custom_item_source_user_default_key ON dndshare.custom_item_source USING btree (user_id) WHERE is_default;

CREATE INDEX idx_content_source_compatibility_version ON dndshare.content_source_compatibility USING btree (source_version_id, status);

CREATE INDEX idx_content_source_native_version ON dndshare.content_source USING btree (native_source_version_id);

CREATE INDEX idx_content_source_source_id ON dndshare.content_source USING btree (source_id, sort_order, name);

CREATE INDEX idx_custom_item_source_user_id ON dndshare.custom_item_source USING btree (user_id, id);

CREATE INDEX idx_item_content_source_source_item ON dndshare.item_content_source USING btree (content_source_id, item_id);

CREATE INDEX idx_item_cover_image_id ON dndshare.item USING btree (cover_image_id) WHERE (cover_image_id IS NOT NULL);

CREATE INDEX idx_item_custom_source_id ON dndshare.item USING btree (custom_source_id);

CREATE INDEX idx_item_derived_from ON dndshare.item USING btree (derived_from_item_id);

CREATE UNIQUE INDEX idx_item_edition_import_key ON dndshare.item USING btree (((data ->> 'edition_key'::text))) WHERE ((user_id IS NULL) AND ((data ->> 'edition_key'::text) IS NOT NULL));

CREATE INDEX idx_item_edition_replacement ON dndshare.item_version_compatibility USING btree (replaced_by_item_id);

CREATE INDEX idx_item_edition_selection ON dndshare.item_version_compatibility USING btree (source_version_id, status, item_id);

CREATE INDEX idx_item_icon_image_id ON dndshare.item USING btree (icon_image_id) WHERE (icon_image_id IS NOT NULL);

CREATE UNIQUE INDEX idx_item_icon_preset_empty ON dndshare.item_icon_preset USING btree (item_type_id) WHERE ((purpose)::text = 'empty_cell'::text);

CREATE INDEX idx_item_icon_preset_image ON dndshare.item_icon_preset USING btree (image_id);

CREATE INDEX idx_item_icon_svg_id ON dndshare.item USING btree (icon_svg_id) WHERE (icon_svg_id IS NOT NULL);

CREATE INDEX idx_item_type_cover_image_id ON dndshare.item_type USING btree (cover_image_id);

CREATE INDEX idx_item_type_icon_image_id ON dndshare.item_type USING btree (icon_image_id);

CREATE INDEX idx_item_type_parent_type_id ON dndshare.item_type USING btree (parent_type_id);

CREATE INDEX idx_item_type_source_id ON dndshare.item_type USING btree (source_id);

CREATE INDEX idx_item_user_id ON dndshare.item USING btree (user_id);

CREATE INDEX idx_item_version_compatibility_version ON dndshare.item_version_compatibility USING btree (source_version_id, status);

CREATE INDEX idx_source_version_source_id ON dndshare.source_version USING btree (source_id);

CREATE INDEX idx_suggest_icon_image_id ON dndshare.suggest USING btree (icon_image_id) WHERE (icon_image_id IS NOT NULL);

CREATE INDEX idx_suggest_svg_id ON dndshare.suggest USING btree (svg_id);

CREATE INDEX idx_suggest_type_source_id ON dndshare.suggest_type USING btree (source_id);

CREATE INDEX idx_suggest_type_svg_id ON dndshare.suggest_type USING btree (svg_id);

CREATE INDEX idx_svg_storage_user_created ON dndshare.svg_storage USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);

CREATE INDEX item_data_gin_idx ON dndshare.item USING gin (data jsonb_path_ops);

CREATE INDEX item_name_trgm_idx ON dndshare.item USING gin (name public.gin_trgm_ops);

CREATE INDEX item_parent_id_idx ON dndshare.item USING btree (parent_id) WHERE (parent_id IS NOT NULL);

CREATE UNIQUE INDEX item_transfer_inventory_action ON dndshare.item_transfer USING btree (session_id, client_action_id) WHERE (sender_char_id IS NULL);

CREATE INDEX item_transfer_pending_recipient ON dndshare.item_transfer USING btree (recipient_char_id) WHERE (status = 'pending'::text);

CREATE INDEX item_transfer_pending_sender ON dndshare.item_transfer USING btree (sender_char_id) WHERE (status = 'pending'::text);

CREATE INDEX item_type_id_idx ON dndshare.item USING btree (type_id, name);

CREATE INDEX item_type_public_name_idx ON dndshare.item USING btree (type_id, name, id) WHERE (user_id IS NULL);

CREATE INDEX item_type_user_name_idx ON dndshare.item USING btree (type_id, user_id, name, id);

CREATE INDEX suggest_base_type_value_idx ON dndshare.suggest USING btree (type_id, lower((value)::text), id) WHERE (user_id IS NULL);

CREATE INDEX suggest_user_type_user_value_idx ON dndshare.suggest USING btree (type_id, user_id, lower((value)::text), id) WHERE (user_id IS NOT NULL);
