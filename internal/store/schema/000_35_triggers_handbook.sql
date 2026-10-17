-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TRIGGER ability_type_fields AFTER UPDATE OF fields ON dndshare.item_type FOR EACH ROW WHEN ((new.id = ANY (ARRAY[(3)::bigint, (4)::bigint, (18)::bigint]))) EXECUTE FUNCTION dndshare.sync_ability_type_fields();

CREATE TRIGGER item_normalize_origin_relation BEFORE INSERT OR UPDATE OF type_id, parent_id, data, user_id ON dndshare.item FOR EACH ROW EXECUTE FUNCTION dndshare.normalize_origin_item_relation();

CREATE TRIGGER item_sync_origin_reverse_relation AFTER INSERT OR DELETE OR UPDATE OF type_id, parent_id, data, user_id, name ON dndshare.item FOR EACH ROW EXECUTE FUNCTION dndshare.sync_origin_reverse_relation();
