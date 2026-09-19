-- These runtime references have an object contract; the generic editor must
-- preserve it instead of replacing {id} with a bare number.
CREATE FUNCTION pg_temp.application_reference_fields(fields jsonb, parent text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb := '[]'; f jsonb; path text;
BEGIN
 FOR f IN SELECT value FROM jsonb_array_elements(fields) LOOP
  path := CASE WHEN parent='' THEN f->>'key' ELSE parent||'.'||(f->>'key') END;
  IF f->>'type'='item' AND (f->>'key' IN ('effect','on_end_effect') OR path='usable.spell') THEN
   f := f || '{"reference_shape":"object"}'::jsonb;
  END IF;
  IF jsonb_typeof(f->'fields')='array' THEN
   f := jsonb_set(f,'{fields}',pg_temp.application_reference_fields(f->'fields',path));
  END IF;
  result := result || jsonb_build_array(f);
 END LOOP;
 RETURN result;
END $$;
UPDATE dndshare.item_type SET fields=pg_temp.application_reference_fields(fields);
CREATE FUNCTION pg_temp.application_reference_data(data jsonb, fields jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb := data; f jsonb; v jsonb; converted jsonb;
BEGIN
 IF jsonb_typeof(data) IS DISTINCT FROM 'object' THEN RETURN data; END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(fields) LOOP
  v := data->(f->>'key');
  IF f->>'reference_shape'='object' AND jsonb_typeof(v) IN ('number','string') AND (v#>>'{}') ~ '^[0-9]+$' THEN
   result := jsonb_set(result,ARRAY[f->>'key'],jsonb_build_object('id',(v#>>'{}')::bigint));
  ELSIF f->>'type'='object' AND jsonb_typeof(v)='object' THEN
   result := jsonb_set(result,ARRAY[f->>'key'],pg_temp.application_reference_data(v,COALESCE(f->'fields','[]'::jsonb)));
  ELSIF f->>'type'='object_array' AND jsonb_typeof(v)='array' THEN
   SELECT COALESCE(jsonb_agg(pg_temp.application_reference_data(value,COALESCE(f->'fields','[]'::jsonb)) ORDER BY ord),'[]'::jsonb) INTO converted FROM jsonb_array_elements(v) WITH ORDINALITY a(value,ord);
   result := jsonb_set(result,ARRAY[f->>'key'],converted);
  END IF;
 END LOOP;
 RETURN result;
END $$;
UPDATE dndshare.item i SET data=pg_temp.application_reference_data(i.data,t.fields) FROM dndshare.item_type t WHERE i.type_id=t.id AND i.data IS DISTINCT FROM pg_temp.application_reference_data(i.data,t.fields);
DROP FUNCTION pg_temp.application_reference_data(jsonb,jsonb);
DROP FUNCTION pg_temp.application_reference_fields(jsonb,text);
