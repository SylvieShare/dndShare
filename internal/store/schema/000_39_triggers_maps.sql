-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TRIGGER map_model_definition_identity BEFORE INSERT OR UPDATE OF collection, source_code, source_name, definition_id ON dndshare.map_model FOR EACH ROW EXECUTE FUNCTION dndshare.assign_map_model_definition();

CREATE TRIGGER map_model_group_default BEFORE INSERT ON dndshare.map_model_definition FOR EACH ROW EXECUTE FUNCTION dndshare.default_map_model_group_code();
