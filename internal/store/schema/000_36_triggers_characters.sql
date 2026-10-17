-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TRIGGER character_edition_validation BEFORE INSERT OR UPDATE OF data, source_version_id ON dndshare."char" FOR EACH ROW EXECUTE FUNCTION dndshare.validate_character_edition();

CREATE TRIGGER pending_transfer_character BEFORE UPDATE OF deleted ON dndshare."char" FOR EACH ROW EXECUTE FUNCTION dndshare.guard_pending_item_transfers();
