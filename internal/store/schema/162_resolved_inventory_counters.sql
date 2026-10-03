-- Finish the reviewed counter transfer; removed counters remain in the audit.
ALTER TABLE dndshare.inventory_counter_migration
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'transfer'
    CHECK(action IN ('transfer','delete')),
  ADD COLUMN IF NOT EXISTS inventory_before jsonb,
  ADD COLUMN IF NOT EXISTS inventory_after jsonb;

DO $$
DECLARE
  plan record;
  character record;
  tile jsonb;
  inventory_before jsonb;
  inventory jsonb;
  sections jsonb;
  section jsonb;
  items jsonb;
  original_items jsonb;
  slots jsonb;
  outputs jsonb;
  output jsonb;
  item jsonb;
  pack jsonb;
  component jsonb;
  contents jsonb;
  counters jsonb;
  created_entry jsonb;
  pack_found boolean;
  uid text;
  used integer[];
  slot integer;
  section_index integer;
BEGIN
  FOR plan IN SELECT * FROM (VALUES
    ('d42188e0-cc1b-4375-8af7-5d638bbd179d'::uuid,'cnt3l3g8','Бурдюк','transfer',442::bigint,NULL::text),
    ('8a705fca-08ae-4ef9-b8fd-73faa9245413'::uuid,'cnt3320g','Сухпайки','transfer',420::bigint,'eq_3'),
    ('8a705fca-08ae-4ef9-b8fd-73faa9245413'::uuid,'cnt435o8','2352','delete',NULL::bigint,NULL::text),
    ('8a705fca-08ae-4ef9-b8fd-73faa9245413'::uuid,'cnt5gc16','23532','delete',NULL::bigint,NULL::text),
    ('5a1d477f-59f3-4be5-ab8a-bfedb0f85de8'::uuid,'cnt125vf','dfcghjk','delete',NULL::bigint,NULL::text),
    ('07ae13a7-83ca-44a9-a9f6-ef7dbe1b3695'::uuid,'cnt2i085','Сухой паёк','transfer',420::bigint,'eq_0'),
    ('07ae13a7-83ca-44a9-a9f6-ef7dbe1b3695'::uuid,'cnt5h6ny','Деревянный элемент с кружкой эля','transfer',NULL::bigint,NULL::text)
  ) seed(char_uuid,counter_id,counter_name,action,item_id,pack_uid) LOOP
    SELECT * INTO character FROM dndshare."char" WHERE uuid=plan.char_uuid FOR UPDATE;
    IF NOT FOUND OR EXISTS (
      SELECT 1 FROM dndshare.inventory_counter_migration
      WHERE char_id=character.id AND counter_id=plan.counter_id
    ) THEN CONTINUE; END IF;
    SELECT counter INTO tile FROM jsonb_array_elements(
      COALESCE(character.data#>'{values,counters}','[]'::jsonb)
    ) counter WHERE counter->>'id'=plan.counter_id;
    IF tile IS NULL THEN CONTINUE; END IF;
    IF tile->>'name' IS DISTINCT FROM plan.counter_name THEN
      RAISE EXCEPTION 'Reviewed counter % changed its meaning',plan.counter_id;
    END IF;
    inventory_before := character.data#>'{values,items}';
    inventory := COALESCE(inventory_before,'{"equipped":[],"sections":[]}'::jsonb);
    created_entry := 'null'::jsonb;

    IF plan.action='transfer' THEN
      IF NULLIF(tile->>'max','') IS NOT NULL OR COALESCE(tile->>'value','') !~ '^[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'Reviewed physical counter % changed its quantity contract',plan.counter_id;
      END IF;
      sections := COALESCE(inventory->'sections','[]'::jsonb);
      IF jsonb_array_length(sections)=0 THEN
        sections := jsonb_build_array(jsonb_build_object(
          'id','sec-counters-' || character.id,'name','Рюкзак','items','[]'::jsonb,'slots','{}'::jsonb
        ));
      END IF;
      IF plan.item_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM (
          SELECT jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb)) entry
          UNION ALL
          SELECT jsonb_array_elements(COALESCE(s->'items','[]'::jsonb)) FROM jsonb_array_elements(sections) s
        ) owned WHERE entry->>'item_id'=plan.item_id::text
      ) THEN
        RAISE EXCEPTION 'Reviewed counter % now overlaps an owned stack',plan.counter_id;
      END IF;
      created_entry := jsonb_build_object(
        'uid','counter-' || character.id || '-' || plan.counter_id,
        'item_id',plan.item_id,'count',(tile->>'value')::integer,'params','{}'::jsonb,
        'icon_preset_id',NULL,'override',CASE WHEN plan.item_id IS NULL
          THEN jsonb_build_object('name',tile->>'name') ELSE 'null'::jsonb END
      );
      outputs := jsonb_build_array(created_entry);

      IF plan.pack_uid IS NOT NULL THEN
        pack_found := false;
        FOR section_index IN 0..jsonb_array_length(sections)-1 LOOP
          section := sections->section_index;
          original_items := COALESCE(section->'items','[]'::jsonb);
          items := '[]'::jsonb;
          FOR item IN SELECT value FROM jsonb_array_elements(original_items) LOOP
            IF item->>'uid' IS DISTINCT FROM plan.pack_uid THEN
              items := items || jsonb_build_array(item); CONTINUE;
            END IF;
            pack_found := true;
            IF COALESCE(item->>'count','1') <> '1' OR COALESCE(item->'params','{}'::jsonb) <> '{}'::jsonb THEN
              RAISE EXCEPTION 'Reviewed equipment pack % has changed',plan.pack_uid;
            END IF;
            IF item->>'item_id' IS NULL AND item#>>'{override,name}'='Набор артиста' THEN
              -- Custom packs have no known contents; do not manufacture their components.
              item := jsonb_set(item,'{override}',COALESCE(item->'override','{}'::jsonb) ||
                jsonb_build_object('name','Набор артиста (без пайков)',
                  'desc',COALESCE(item#>>'{override,desc}','') || '<p>Пайки хранятся отдельно.</p>'));
              items := items || jsonb_build_array(item);
            ELSIF item->>'item_id'='447' AND COALESCE(item->'override','null'::jsonb)='null'::jsonb THEN
              SELECT data->'contents' INTO contents FROM dndshare.item WHERE id=447;
              IF contents IS NULL OR jsonb_typeof(contents)<>'array'
                OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(contents) c WHERE c->>'item_id'='420')
                OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(contents) c WHERE c->>'item_id'='354')
              THEN RAISE EXCEPTION 'Reviewed equipment pack contents are unavailable'; END IF;
              -- Keep the pack's cell/UID for its backpack; all other components get new UIDs.
              FOR component IN SELECT value FROM jsonb_array_elements(contents) LOOP
                IF component->>'item_id'='420' THEN CONTINUE; END IF;
                pack := jsonb_build_object(
                  'uid',CASE WHEN component->>'item_id'='354' THEN plan.pack_uid
                    ELSE created_entry->>'uid' || '-part-' || (component->>'item_id') END,
                  'item_id',component->'item_id','count',component->'count',
                  'params',COALESCE(component->'params','{}'::jsonb),'override',NULL,'icon_preset_id',NULL
                );
                IF component->>'item_id'='354' THEN items := items || jsonb_build_array(pack);
                ELSE outputs := outputs || jsonb_build_array(pack); END IF;
              END LOOP;
            ELSE RAISE EXCEPTION 'Reviewed equipment pack % no longer matches',plan.pack_uid;
            END IF;
          END LOOP;
          sections := jsonb_set(sections,ARRAY[section_index::text,'items'],items);
        END LOOP;
        IF NOT pack_found THEN RAISE EXCEPTION 'Reviewed equipment pack % is missing',plan.pack_uid; END IF;
      END IF;

      section := sections->0;
      slots := COALESCE(section->'slots','{}'::jsonb);
      SELECT COALESCE(array_agg(value::integer),'{}'::integer[]) INTO used
        FROM jsonb_each_text(slots) WHERE value ~ '^[0-9]+$';
      FOR uid IN SELECT physical->>'uid' FROM (
        SELECT jsonb_array_elements(COALESCE(section->'items','[]'::jsonb)) physical
        UNION ALL SELECT jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb))
      ) owned LOOP
        IF uid IS NULL OR slots ? uid OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(sections) s WHERE COALESCE(s->'slots','{}'::jsonb) ? uid
        ) THEN CONTINUE; END IF;
        slot := 0; WHILE slot=ANY(used) LOOP slot:=slot+1; END LOOP;
        slots := slots || jsonb_build_object(uid,slot); used := array_append(used,slot);
      END LOOP;
      items := COALESCE(section->'items','[]'::jsonb);
      FOR output IN SELECT value FROM jsonb_array_elements(outputs) LOOP
        uid := output->>'uid';
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements(sections) s,
            jsonb_array_elements(COALESCE(s->'items','[]'::jsonb)) e WHERE e->>'uid'=uid
        ) OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb)) e WHERE e->>'uid'=uid
        ) THEN RAISE EXCEPTION 'Counter migration UID already exists: %',uid; END IF;
        slot := 0; WHILE slot=ANY(used) LOOP slot:=slot+1; END LOOP;
        slots := slots || jsonb_build_object(uid,slot); used := array_append(used,slot);
        items := items || jsonb_build_array(output);
      END LOOP;
      section := jsonb_set(jsonb_set(section,'{items}',items),'{slots}',slots);
      sections := jsonb_set(sections,'{0}',section);
      inventory := jsonb_set(inventory,'{sections}',sections);
    END IF;

    SELECT COALESCE(jsonb_agg(counter ORDER BY position),'[]'::jsonb) INTO counters
      FROM jsonb_array_elements(character.data#>'{values,counters}') WITH ORDINALITY c(counter,position)
      WHERE counter->>'id' IS DISTINCT FROM plan.counter_id;
    IF plan.action='transfer' THEN character.data:=jsonb_set(character.data,'{values,items}',inventory); END IF;
    UPDATE dndshare."char" SET data=jsonb_set(character.data,'{values,counters}',counters),
      version=version+1,changed_at=now() WHERE id=character.id;
    INSERT INTO dndshare.inventory_counter_migration
      (char_id,counter_id,original_counter,created_entry,section_id,previous_version,action,inventory_before,inventory_after)
      VALUES(character.id,plan.counter_id,tile,created_entry,
        COALESCE(inventory#>>'{sections,0,id}',''),character.version,plan.action,inventory_before,
        CASE WHEN plan.action='transfer' THEN inventory ELSE inventory_before END);
  END LOOP;
END $$;
