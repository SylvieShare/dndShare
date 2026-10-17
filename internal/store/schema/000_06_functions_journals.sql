-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE FUNCTION dndshare.journal_entry_node() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO dndshare.journal_node(entry_id, journal_id)
    SELECT NEW.id, journal_id FROM dndshare.journal_section WHERE id=NEW.section_id;
    RETURN NULL;
END;
$$;

CREATE FUNCTION dndshare.journal_graph_changed() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE dndshare.journal SET graph_revision=graph_revision+1, changed_at=now()
    WHERE id=COALESCE(NEW.journal_id, OLD.journal_id);
    RETURN NULL;
END;
$$;
