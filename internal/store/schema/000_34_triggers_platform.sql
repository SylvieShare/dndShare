-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TRIGGER users_default_custom_item_source AFTER INSERT ON dndshare.users FOR EACH ROW EXECUTE FUNCTION dndshare.create_default_custom_item_source();

CREATE TRIGGER users_default_source_version BEFORE INSERT ON dndshare.users FOR EACH ROW EXECUTE FUNCTION dndshare.set_default_user_source_version();
