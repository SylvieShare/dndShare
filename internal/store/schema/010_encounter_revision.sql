ALTER TABLE dndshare.session_encounter ADD COLUMN revision bigint NOT NULL DEFAULT 1;
CREATE FUNCTION dndshare.bump_session_encounter_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.revision := OLD.revision + 1;
    RETURN NEW;
END;
$$;
CREATE TRIGGER bump_session_encounter_revision BEFORE UPDATE ON dndshare.session_encounter
FOR EACH ROW EXECUTE FUNCTION dndshare.bump_session_encounter_revision();
