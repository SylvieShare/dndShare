-- Only reviewed physical counters are transferred. Ambiguous counters remain intact.
CREATE TABLE IF NOT EXISTS dndshare.inventory_counter_migration (
  char_id bigint NOT NULL REFERENCES dndshare."char"(id) ON DELETE CASCADE,
  counter_id text NOT NULL,
  original_counter jsonb NOT NULL,
  created_entry jsonb NOT NULL,
  section_id text NOT NULL,
  previous_version bigint NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(char_id,counter_id)
);

DO $$
DECLARE
  plan record;
  character record;
  tile jsonb;
  inventory jsonb;
  sections jsonb;
  backpack jsonb;
  slots jsonb;
  entry jsonb;
  counters jsonb;
  uid text;
  slot integer;
  used integer[];
BEGIN
  FOR plan IN SELECT * FROM (VALUES
    ('cc503ec7-8250-4c00-a9a4-b830f39cdaf1'::uuid,'cnt277mg','Стрелы',347::bigint),
    ('cc503ec7-8250-4c00-a9a4-b830f39cdaf1'::uuid,'cnt3jjx8','Рацион',420::bigint),
    ('d42188e0-cc1b-4375-8af7-5d638bbd179d'::uuid,'cnt1owp','Факел',439::bigint),
    ('d42188e0-cc1b-4375-8af7-5d638bbd179d'::uuid,'cnt28i73','Рацион',420::bigint),
    ('8c53c0f7-b697-49b1-9544-c0ff9e2cf86c'::uuid,'cnt277mg','Стрелы',347::bigint),
    ('8c53c0f7-b697-49b1-9544-c0ff9e2cf86c'::uuid,'cnt3jjx8','Рацион',420::bigint),
    ('8a705fca-08ae-4ef9-b8fd-73faa9245413'::uuid,'cnt2rc6','факел',439::bigint),
    ('07ae13a7-83ca-44a9-a9f6-ef7dbe1b3695'::uuid,'cnt3hdvm','Одежда культистов',1431::bigint),
    ('07ae13a7-83ca-44a9-a9f6-ef7dbe1b3695'::uuid,'cnt46hh6','Медальон',NULL::bigint)
  ) seed(char_uuid,counter_id,counter_name,item_id) LOOP
    SELECT * INTO character FROM dndshare."char" WHERE uuid=plan.char_uuid FOR UPDATE;
    IF NOT FOUND OR EXISTS (
      SELECT 1 FROM dndshare.inventory_counter_migration
      WHERE char_id=character.id AND counter_id=plan.counter_id
    ) THEN CONTINUE; END IF;
    SELECT counter INTO tile FROM jsonb_array_elements(
      COALESCE(character.data#>'{values,counters}','[]'::jsonb)
    ) counter WHERE counter->>'id'=plan.counter_id;
    IF tile IS NULL OR tile->>'name' IS DISTINCT FROM plan.counter_name
      OR NULLIF(tile->>'max','') IS NOT NULL
      OR COALESCE(tile->>'value','') !~ '^[1-9][0-9]*$'
    THEN CONTINUE; END IF;

    inventory := COALESCE(character.data#>'{values,items}','{"equipped":[],"sections":[]}'::jsonb);
    sections := COALESCE(inventory->'sections','[]'::jsonb);
    IF jsonb_array_length(sections)=0 THEN
      sections := jsonb_build_array(jsonb_build_object(
        'id','sec-counters-' || character.id,'name','Рюкзак','items','[]'::jsonb,'slots','{}'::jsonb
      ));
    END IF;
    -- A newly acquired matching stack makes the amount ambiguous; leave its tile alone.
    IF plan.item_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM (
        SELECT jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb)) existing
        UNION ALL
        SELECT jsonb_array_elements(section->'items') FROM jsonb_array_elements(sections) section
      ) owned WHERE existing->>'item_id'=plan.item_id::text
    ) THEN CONTINUE; END IF;

    backpack := sections->0;
    uid := 'counter-' || character.id || '-' || plan.counter_id;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb)) e WHERE e->>'uid'=uid
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(sections) s,
      jsonb_array_elements(COALESCE(s->'items','[]'::jsonb)) e WHERE e->>'uid'=uid
    ) THEN RAISE EXCEPTION 'Counter migration UID already exists: %',uid; END IF;
    entry := jsonb_build_object(
      'uid',uid,'item_id',plan.item_id,'count',(tile->>'value')::integer,
      'params','{}'::jsonb,'icon_preset_id',NULL,
      'override',CASE WHEN plan.item_id IS NULL
        THEN jsonb_build_object('name',tile->>'name') ELSE 'null'::jsonb END
    );
    slots := COALESCE(backpack->'slots','{}'::jsonb);
    SELECT COALESCE(array_agg(value::integer),'{}'::integer[]) INTO used
      FROM jsonb_each_text(slots) WHERE value ~ '^[0-9]+$';
    -- Retain entries that predate explicit placement, including equipped UIDs.
    FOR uid IN SELECT physical->>'uid' FROM (
      SELECT jsonb_array_elements(COALESCE(backpack->'items','[]'::jsonb)) physical
      UNION ALL
      SELECT jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb))
    ) owned LOOP
      IF uid IS NULL OR slots ? uid OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(sections) s WHERE COALESCE(s->'slots','{}'::jsonb) ? uid
      ) THEN CONTINUE; END IF;
      slot := 0; WHILE slot=ANY(used) LOOP slot:=slot+1; END LOOP;
      slots := slots || jsonb_build_object(uid,slot); used := array_append(used,slot);
    END LOOP;
    uid := entry->>'uid';
    slot := 0; WHILE slot=ANY(used) LOOP slot:=slot+1; END LOOP;
    slots := slots || jsonb_build_object(uid,slot);
    backpack := jsonb_set(backpack,'{items}',COALESCE(backpack->'items','[]'::jsonb) || jsonb_build_array(entry));
    backpack := jsonb_set(backpack,'{slots}',slots);
    sections := jsonb_set(sections,'{0}',backpack);
    inventory := jsonb_set(inventory,'{sections}',sections);
    SELECT COALESCE(jsonb_agg(counter ORDER BY position),'[]'::jsonb) INTO counters
      FROM jsonb_array_elements(character.data#>'{values,counters}') WITH ORDINALITY c(counter,position)
      WHERE counter->>'id' IS DISTINCT FROM plan.counter_id;
    UPDATE dndshare."char"
      SET data=jsonb_set(jsonb_set(character.data,'{values,items}',inventory),'{values,counters}',counters),
          version=version+1,changed_at=now()
      WHERE id=character.id;
    INSERT INTO dndshare.inventory_counter_migration
      (char_id,counter_id,original_counter,created_entry,section_id,previous_version)
      VALUES(character.id,plan.counter_id,tile,entry,backpack->>'id',character.version);
  END LOOP;
END $$;
