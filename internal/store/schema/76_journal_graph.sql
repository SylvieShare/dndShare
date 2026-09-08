ALTER TABLE dndshare.journal ADD COLUMN graph_revision bigint NOT NULL DEFAULT 0;

CREATE TABLE dndshare.journal_node (
    entry_id bigint PRIMARY KEY REFERENCES dndshare.journal_entry(id) ON DELETE CASCADE,
    journal_id bigint NOT NULL REFERENCES dndshare.journal(id) ON DELETE CASCADE,
    position_x double precision NOT NULL DEFAULT 0 CHECK (position_x BETWEEN -1000000 AND 1000000),
    position_y double precision NOT NULL DEFAULT 0 CHECK (position_y BETWEEN -1000000 AND 1000000),
    UNIQUE (journal_id, entry_id)
);
CREATE TABLE dndshare.journal_link (
    journal_id bigint NOT NULL REFERENCES dndshare.journal(id) ON DELETE CASCADE,
    from_id bigint NOT NULL,
    to_id bigint NOT NULL,
    label varchar(240) NOT NULL DEFAULT '',
    PRIMARY KEY (from_id, to_id),
    FOREIGN KEY (journal_id, from_id) REFERENCES dndshare.journal_node(journal_id, entry_id) ON DELETE CASCADE,
    FOREIGN KEY (journal_id, to_id) REFERENCES dndshare.journal_node(journal_id, entry_id) ON DELETE CASCADE,
    CHECK (from_id <> to_id)
);
CREATE INDEX journal_link_target_idx ON dndshare.journal_link(journal_id, to_id);

-- Preserve every entry, author, payload and timestamp. Each section starts as
-- its original chronological chain, growing upwards on the canvas.
INSERT INTO dndshare.journal_node (entry_id, journal_id, position_x, position_y)
SELECT e.id, s.journal_id, 0, -200 * (row_number() OVER (PARTITION BY e.section_id ORDER BY e.position, e.id) - 1)
FROM dndshare.journal_entry e JOIN dndshare.journal_section s ON s.id=e.section_id;
INSERT INTO dndshare.journal_link (journal_id, from_id, to_id)
SELECT journal_id, previous_id, id FROM (
    SELECT s.journal_id, e.id, lag(e.id) OVER (PARTITION BY e.section_id ORDER BY e.position, e.id) AS previous_id
    FROM dndshare.journal_entry e JOIN dndshare.journal_section s ON s.id=e.section_id
) chain WHERE previous_id IS NOT NULL;

CREATE FUNCTION dndshare.journal_graph_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE dndshare.journal SET graph_revision=graph_revision+1, changed_at=now()
    WHERE id=COALESCE(NEW.journal_id, OLD.journal_id);
    RETURN NULL;
END;
$$;
CREATE TRIGGER journal_node_revision AFTER INSERT OR UPDATE OR DELETE ON dndshare.journal_node
FOR EACH ROW EXECUTE FUNCTION dndshare.journal_graph_changed();
CREATE TRIGGER journal_link_revision AFTER INSERT OR UPDATE OR DELETE ON dndshare.journal_link
FOR EACH ROW EXECUTE FUNCTION dndshare.journal_graph_changed();

CREATE FUNCTION dndshare.journal_entry_node() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO dndshare.journal_node(entry_id, journal_id)
    SELECT NEW.id, journal_id FROM dndshare.journal_section WHERE id=NEW.section_id;
    RETURN NULL;
END;
$$;
CREATE TRIGGER journal_entry_node_insert AFTER INSERT ON dndshare.journal_entry
FOR EACH ROW EXECUTE FUNCTION dndshare.journal_entry_node();
