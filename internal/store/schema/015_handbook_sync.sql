ALTER TABLE dndshare.item
    ADD COLUMN deleted boolean NOT NULL DEFAULT false,
    ADD COLUMN changed_at timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN sync_revision bigint NOT NULL DEFAULT 0;

-- Ordinary readers never resolve soft-deleted entries. The physical table also
-- retains media references and supplies tombstones to the synchronization API.
CREATE VIEW dndshare.active_item AS
    SELECT * FROM dndshare.item WHERE NOT deleted;

CREATE TABLE dndshare.handbook_sync_clock (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)
);

-- Acquire the catalogue's existing graph lock before any row locks. Otherwise
-- two multi-row writers could lock different items before contending on the
-- revision clock, and deadlock while updating their remaining items.
CREATE FUNCTION dndshare.lock_handbook_sync_write() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(1145980229);
    RETURN NULL;
END;
$$;
CREATE TRIGGER handbook_item_write_lock
    BEFORE INSERT OR UPDATE OR DELETE ON dndshare.item
    FOR EACH STATEMENT EXECUTE FUNCTION dndshare.lock_handbook_sync_write();
CREATE TRIGGER handbook_compatibility_write_lock
    BEFORE INSERT OR UPDATE OR DELETE ON dndshare.item_version_compatibility
    FOR EACH STATEMENT EXECUTE FUNCTION dndshare.lock_handbook_sync_write();
CREATE TRIGGER handbook_publication_write_lock
    BEFORE INSERT OR UPDATE OR DELETE ON dndshare.item_content_source
    FOR EACH STATEMENT EXECUTE FUNCTION dndshare.lock_handbook_sync_write();
CREATE TRIGGER handbook_model_write_lock
    BEFORE INSERT OR UPDATE OR DELETE ON dndshare.item_model
    FOR EACH STATEMENT EXECUTE FUNCTION dndshare.lock_handbook_sync_write();
CREATE TRIGGER handbook_type_write_lock
    BEFORE INSERT OR UPDATE OR DELETE ON dndshare.item_type
    FOR EACH STATEMENT EXECUTE FUNCTION dndshare.lock_handbook_sync_write();

-- Updating a transactional row, rather than nextval(), serializes committed
-- revisions. A later committed cursor cannot skip an earlier uncommitted write.
CREATE FUNCTION dndshare.touch_handbook_item() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO dndshare.handbook_sync_clock(singleton, revision) VALUES (true, 1)
    ON CONFLICT (singleton) DO UPDATE
        SET revision = dndshare.handbook_sync_clock.revision + 1
    RETURNING revision INTO NEW.sync_revision;
    NEW.changed_at := clock_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER handbook_item_revision
    BEFORE INSERT OR UPDATE ON dndshare.item
    FOR EACH ROW EXECUTE FUNCTION dndshare.touch_handbook_item();

CREATE FUNCTION dndshare.touch_handbook_item_relation() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE dndshare.item SET sync_revision = sync_revision WHERE id = OLD.item_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE dndshare.item SET sync_revision = sync_revision WHERE id = NEW.item_id;
    ELSE
        UPDATE dndshare.item SET sync_revision = sync_revision WHERE id = NEW.item_id;
        IF OLD.item_id IS DISTINCT FROM NEW.item_id THEN
            UPDATE dndshare.item SET sync_revision = sync_revision WHERE id = OLD.item_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER handbook_compatibility_revision
    AFTER INSERT OR UPDATE OR DELETE ON dndshare.item_version_compatibility
    FOR EACH ROW EXECUTE FUNCTION dndshare.touch_handbook_item_relation();
CREATE TRIGGER handbook_publication_revision
    AFTER INSERT OR UPDATE OR DELETE ON dndshare.item_content_source
    FOR EACH ROW EXECUTE FUNCTION dndshare.touch_handbook_item_relation();
CREATE TRIGGER handbook_model_revision
    AFTER INSERT OR UPDATE OR DELETE ON dndshare.item_model
    FOR EACH ROW EXECUTE FUNCTION dndshare.touch_handbook_item_relation();

CREATE FUNCTION dndshare.touch_handbook_type_source() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.source_id IS DISTINCT FROM OLD.source_id THEN
        UPDATE dndshare.item SET sync_revision = sync_revision WHERE type_id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;
CREATE TRIGGER handbook_type_source_revision
    AFTER UPDATE OF source_id ON dndshare.item_type
    FOR EACH ROW EXECUTE FUNCTION dndshare.touch_handbook_type_source();

CREATE INDEX item_sync_revision_idx ON dndshare.item (sync_revision, id);
