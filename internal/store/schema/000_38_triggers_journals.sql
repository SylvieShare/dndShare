-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE TRIGGER journal_entry_node_insert AFTER INSERT ON dndshare.journal_entry FOR EACH ROW EXECUTE FUNCTION dndshare.journal_entry_node();

CREATE TRIGGER journal_link_revision AFTER INSERT OR DELETE OR UPDATE ON dndshare.journal_link FOR EACH ROW EXECUTE FUNCTION dndshare.journal_graph_changed();

CREATE TRIGGER journal_node_revision AFTER INSERT OR DELETE OR UPDATE ON dndshare.journal_node FOR EACH ROW EXECUTE FUNCTION dndshare.journal_graph_changed();
