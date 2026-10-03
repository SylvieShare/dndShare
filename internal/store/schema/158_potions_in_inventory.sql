-- Potions are ordinary owned inventory entries. Preserve every instance and its state.
DO $$
DECLARE
    character record;
    values_doc jsonb;
    inventory jsonb;
    sections jsonb;
    backpack jsonb;
    potions jsonb;
    physical_items jsonb;
    old_slots jsonb;
    slots jsonb;
    entry jsonb;
    uid text;
    slot integer;
    used integer[];
BEGIN
    FOR character IN SELECT id,data FROM dndshare."char" WHERE data#>'{values}' ? 'potions' OR EXISTS (SELECT 1 FROM dndshare.item_transfer t WHERE t.sender_char_id="char".id AND t.source='potions' AND t.status='pending') FOR UPDATE LOOP
        values_doc := character.data->'values';
        potions := COALESCE(values_doc->'potions','[]'::jsonb);
        IF potions = 'null'::jsonb THEN potions := '[]'::jsonb; END IF;
        IF jsonb_typeof(potions) <> 'array' THEN
            RAISE EXCEPTION 'Invalid potion collection on character %',character.id;
        END IF;
        IF jsonb_array_length(potions) > 0 OR EXISTS (SELECT 1 FROM dndshare.item_transfer t WHERE t.sender_char_id=character.id AND t.source='potions' AND t.status='pending') THEN
            inventory := COALESCE(values_doc->'items','{"equipped":[],"sections":[]}'::jsonb);
            IF inventory = 'null'::jsonb THEN inventory := '{"equipped":[],"sections":[]}'::jsonb; END IF;
            sections := COALESCE(inventory->'sections','[]'::jsonb);
            IF sections = 'null'::jsonb THEN sections := '[]'::jsonb; END IF;
            IF jsonb_array_length(sections)=0 THEN
                sections := jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'name','Рюкзак','items','[]'::jsonb,'slots','{}'::jsonb));
            END IF;
            backpack := sections->0;
            IF jsonb_typeof(backpack) <> 'object' THEN
                RAISE EXCEPTION 'Invalid inventory space on character %',character.id;
            END IF;
            IF COALESCE(backpack->>'id','')='' THEN backpack := jsonb_set(backpack,'{id}',to_jsonb(gen_random_uuid()::text)); END IF;
            backpack := jsonb_set(backpack,'{items}',COALESCE(backpack->'items','[]'::jsonb));
            physical_items := backpack->'items';
            -- Keep unlocated equipment in its existing first-space projection before adding potions.
            FOR entry IN SELECT value FROM jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb)) LOOP
                uid := entry->>'uid';
                IF backpack->'slots' ? uid OR NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(sections) space WHERE space->'slots' ? uid
                ) THEN physical_items := physical_items || jsonb_build_array(entry); END IF;
            END LOOP;
            old_slots := COALESCE(backpack->'slots','{}'::jsonb);
            slots := '{}'; used := '{}';
            FOR entry IN SELECT value FROM jsonb_array_elements(physical_items) LOOP
                uid := entry->>'uid';
                IF old_slots->>uid ~ '^[0-9]+$' AND (old_slots->>uid)::numeric <= 2147483647 THEN
                    slot := (old_slots->>uid)::integer;
                    IF NOT slot=ANY(used) THEN slots := slots || jsonb_build_object(uid,slot); used := array_append(used,slot); END IF;
                END IF;
            END LOOP;
            FOR entry IN SELECT value FROM jsonb_array_elements(physical_items) LOOP
                uid := entry->>'uid';
                IF NOT slots ? uid THEN
                    slot := 0; WHILE slot=ANY(used) LOOP slot := slot+1; END LOOP;
                    slots := slots || jsonb_build_object(uid,slot); used := array_append(used,slot);
                END IF;
            END LOOP;
            FOR entry IN SELECT value FROM jsonb_array_elements(potions) LOOP
                IF jsonb_typeof(entry) <> 'object' OR COALESCE(entry->>'uid','')='' THEN
                    RAISE EXCEPTION 'Invalid owned potion on character %',character.id;
                END IF;
                uid := entry->>'uid';
                IF slots ? uid OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb)) e WHERE e->>'uid'=uid)
                    OR EXISTS (SELECT 1 FROM jsonb_array_elements(sections) space CROSS JOIN LATERAL jsonb_array_elements(COALESCE(space->'items','[]'::jsonb)) e WHERE e->>'uid'=uid) THEN
                    RAISE EXCEPTION 'Duplicate owned potion UID on character %',character.id;
                END IF;
                -- Custom root-name entries retain their displayed name in the owned-item override.
                IF (entry->'item_id' IS NULL OR entry->'item_id'='null'::jsonb) AND entry->>'name' IS NOT NULL AND entry#>>'{override,name}' IS NULL THEN
                    entry := jsonb_set(entry,'{override}',COALESCE(NULLIF(entry->'override','null'::jsonb),'{}'::jsonb) || jsonb_build_object('name',entry->>'name'));
                END IF;
                slot := 0; WHILE slot=ANY(used) LOOP slot := slot+1; END LOOP;
                slots := slots || jsonb_build_object(uid,slot); used := array_append(used,slot);
                backpack := jsonb_set(backpack,'{items}',(backpack->'items') || jsonb_build_array(entry));
            END LOOP;
            backpack := jsonb_set(backpack,'{slots}',slots);
            sections := jsonb_set(sections,'{0}',backpack);
            inventory := jsonb_set(inventory,'{sections}',sections);
            values_doc := jsonb_set(values_doc,'{items}',inventory);
        END IF;
        UPDATE dndshare."char" SET data=jsonb_set(character.data,'{values}',values_doc-'potions'),version=version+1,changed_at=now() WHERE id=character.id;
    END LOOP;
END $$;

-- Outstanding reservations must return to the migrated original stack.
UPDATE dndshare.item_transfer t SET entry=jsonb_set(t.entry,'{_use_origin}',to_jsonb('section:' || (c.data#>>'{values,items,sections,0,id}')))
FROM dndshare."char" c WHERE t.sender_char_id=c.id AND t.source='potions' AND t.status='pending' AND t.entry->>'_use_origin'='potions';
UPDATE dndshare.item_transfer SET entry=entry-'_use_origin' WHERE source='potions' AND status<>'pending';
UPDATE dndshare.item_transfer SET source='items' WHERE source='potions';
UPDATE dndshare.session_inventory SET source='items' WHERE source='potions';
UPDATE dndshare.item_application SET source='items' WHERE source='potions';
ALTER TABLE dndshare.item_application ALTER COLUMN source SET DEFAULT 'items';
ALTER TABLE dndshare.item_transfer DROP CONSTRAINT item_transfer_source_check;
ALTER TABLE dndshare.item_transfer ADD CONSTRAINT item_transfer_source_check CHECK(source IN ('items','weapon','spells'));
ALTER TABLE dndshare.item_transfer DROP CONSTRAINT item_transfer_use_source;
ALTER TABLE dndshare.item_transfer ADD CONSTRAINT item_transfer_use_source CHECK(purpose <> 'use' OR source IN ('items','weapon','spells'));
ALTER TABLE dndshare.session_inventory DROP CONSTRAINT session_inventory_source_check;
ALTER TABLE dndshare.session_inventory ADD CONSTRAINT session_inventory_source_check CHECK(source IN ('items','weapon'));
ALTER TABLE dndshare."char" ADD CONSTRAINT character_potions_in_inventory CHECK(NOT ((data#>'{values}') ? 'potions'));

CREATE OR REPLACE FUNCTION dndshare.character_rule_item_ids(document jsonb)
RETURNS TABLE(item_id bigint) LANGUAGE sql STABLE AS $$
 WITH candidates AS (
 SELECT jsonb_path_query(document,'$.values.race.id') v
 UNION ALL SELECT jsonb_path_query(document,'$.values.subrace.id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.background.id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.classes[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.classes[*].subclass.id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_race[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_class[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_feats[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_story[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.spells.tabs[*].class_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.spells.tabs[*].spells[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.spells.grants[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.weapon[*].item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.weapon[*].magic_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.equipped[*].item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.equipped[*].magic_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.sections[*].items[*].item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.sections[*].items[*].magic_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.states[*].effect_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.equipped[*].params.armor_base_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.sections[*].items[*].params.armor_base_item_id')
 ), entries AS (
 SELECT jsonb_path_query(document,'$.values.abilities_class[*]') entry
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_race[*]')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_feats[*]')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_story[*]')
 ), choice_refs AS (
 SELECT selected.v FROM entries e
 JOIN dndshare.item i ON i.id=CASE WHEN e.entry->>'id' ~ '^[0-9]{1,18}$' THEN (e.entry->>'id')::bigint END
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.data->'choices')='array' THEN i.data->'choices' ELSE '[]' END) choice
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.entry->'choices'->(choice->>'key'))='array' THEN e.entry->'choices'->(choice->>'key') ELSE '[]' END) selected(v)
 WHERE choice->>'source'='item'
 ), all_refs AS (SELECT v FROM candidates UNION ALL SELECT v FROM choice_refs)
 SELECT DISTINCT (v#>>'{}')::bigint FROM all_refs WHERE (v#>>'{}') ~ '^[0-9]{1,18}$' AND (v#>>'{}')::bigint>0
$$;
