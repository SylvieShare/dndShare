-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TRIGGER pending_transfer_membership BEFORE DELETE ON dndshare.session_participant FOR EACH ROW EXECUTE FUNCTION dndshare.guard_pending_item_transfers();

CREATE TRIGGER pending_transfer_session BEFORE UPDATE OF deleted ON dndshare.session FOR EACH ROW EXECUTE FUNCTION dndshare.guard_pending_item_transfers();

CREATE TRIGGER session_edition_validation BEFORE INSERT OR UPDATE OF system_id, source_version_id ON dndshare.session FOR EACH ROW EXECUTE FUNCTION dndshare.validate_session_edition();
