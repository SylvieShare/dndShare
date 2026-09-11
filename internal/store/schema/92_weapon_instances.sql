-- Weapon instances reference their physical base and optional magic source.
-- Location is the containing collection: weapon, items.equipped or an inventory section.
CREATE FUNCTION pg_temp.weapon_instance(row_data jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  source_data jsonb;
  base_id bigint;
  params jsonb := COALESCE(NULLIF(row_data->'params','null'::jsonb),'{}'::jsonb);
  saved jsonb;
BEGIN
  saved := CASE WHEN jsonb_typeof(params->'_weapon_state')='object' THEN params->'_weapon_state' ELSE '{}'::jsonb END;
  params := params - '_weapon_state' - 'weapon_enabled';
  row_data := saved || row_data;
  SELECT data INTO source_data FROM dndshare.item WHERE id=(row_data->>'item_id')::bigint AND type_id=19;
  IF source_data ? 'weapon' THEN
    base_id := COALESCE(NULLIF(source_data#>>'{weapon,base_item_id}','')::bigint, NULLIF(params->>'weapon_base_item_id','')::bigint);
    IF EXISTS (SELECT 1 FROM dndshare.item WHERE id=base_id AND type_id=1) THEN
      row_data := row_data || jsonb_build_object('magic_item_id',row_data->'item_id','item_id',base_id);
      params := params - 'weapon_base_item_id';
    END IF;
  END IF;
  RETURN row_data || jsonb_build_object('params',params);
END $$;

CREATE FUNCTION pg_temp.migrate_weapon_instances(values_data jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  inventory jsonb := COALESCE(NULLIF(values_data->'items','null'::jsonb),'{}'::jsonb);
  weapons jsonb := '[]'::jsonb;
  equipped jsonb := '[]'::jsonb;
  sections jsonb := '[]'::jsonb;
  section_items jsonb;
  row_data jsonb;
  converted jsonb;
  section_data jsonb;
BEGIN
  FOR row_data IN SELECT value FROM jsonb_array_elements(COALESCE(values_data->'weapon','[]'::jsonb)) LOOP
    weapons := weapons || jsonb_build_array(pg_temp.weapon_instance(row_data));
  END LOOP;
  FOR row_data IN SELECT value FROM jsonb_array_elements(COALESCE(inventory->'equipped','[]'::jsonb)) LOOP
    converted := pg_temp.weapon_instance(row_data);
    IF row_data#>>'{params,weapon_enabled}'='true' AND converted ? 'magic_item_id' THEN
      weapons := weapons || jsonb_build_array(converted - 'count');
    ELSE
      equipped := equipped || jsonb_build_array(converted);
    END IF;
  END LOOP;
  FOR section_data IN SELECT value FROM jsonb_array_elements(COALESCE(inventory->'sections','[]'::jsonb)) LOOP
    section_items := '[]'::jsonb;
    FOR row_data IN SELECT value FROM jsonb_array_elements(COALESCE(section_data->'items','[]'::jsonb)) LOOP
      section_items := section_items || jsonb_build_array(pg_temp.weapon_instance(row_data));
    END LOOP;
    sections := sections || jsonb_build_array(section_data || jsonb_build_object('items',section_items));
  END LOOP;
  IF values_data ? 'weapon' OR jsonb_array_length(weapons)>0 THEN values_data := values_data || jsonb_build_object('weapon',weapons); END IF;
  IF values_data ? 'items' THEN values_data := values_data || jsonb_build_object('items',inventory || jsonb_build_object('equipped',equipped,'sections',sections)); END IF;
  RETURN values_data;
END $$;

UPDATE dndshare.char SET data=jsonb_set(data,'{values}',pg_temp.migrate_weapon_instances(data->'values'))
WHERE jsonb_typeof(data->'values')='object' AND (data->'values' ? 'items' OR data->'values' ? 'weapon');
DROP FUNCTION pg_temp.migrate_weapon_instances(jsonb);
DROP FUNCTION pg_temp.weapon_instance(jsonb);

UPDATE dndshare.item_type SET fields=(
  SELECT jsonb_agg(CASE WHEN field->>'key'='weapon'
    THEN jsonb_set(field, '{hint}', '"При добавлении выбирается основа оружия. Экземпляр хранит ссылку на этот магический предмет, собственную настройку, заряды и поправки. Команда «Переместить в оружие» переносит тот же экземпляр в раздел атак."'::jsonb)
    ELSE field END ORDER BY ord)
  FROM jsonb_array_elements(fields) WITH ORDINALITY f(field,ord)
) WHERE id=19;
