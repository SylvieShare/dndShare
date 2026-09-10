package store

import "context"

// ItemRuleReference is a typed link target, read from the current item JSON.
// No duplicated index needs rebuilding after editing or deleting an item.
type ItemRuleReference struct {
	ItemID   int64  `json:"itemId"`
	ItemName string `json:"itemName"`
	Kind     string `json:"kind"`
	Block    string `json:"block"`
	Key      string `json:"key"`
	Title    string `json:"title"`
	ValueID  string `json:"valueId,omitempty"`
}

func ValidRuleReferenceKind(kind string) bool {
	switch kind {
	case "resource", "resource_pool", "action", "status", "choice", "widget", "counter", "effect_link", "weapon_damage":
		return true
	}
	return false
}

const itemRuleReferencesSQL = `
WITH refs AS (
 SELECT i.id, i.name, r.kind, r.block, r.key, COALESCE(NULLIF(r.title,''),i.name) AS title, r.value_id
 FROM dndshare.item i
 CROSS JOIN LATERAL (
  SELECT spec.kind, spec.block, COALESCE(e->>'key','') AS key, COALESCE(NULLIF(e->>'title',''), NULLIF(e->>'label',''), e->>'text') AS title, '' AS value_id
  FROM (VALUES ('resource','use_resources','Отдельный ресурс'),('resource_pool','class_resources','Ресурс класса'),
   ('action','feature_actions','Действие на листе'),('choice','choices','Выбор'),('widget','sheet_widgets','Виджет листа'),('effect_link','status_effects','Связанный эффект'),('weapon_damage','weapon_damage','Дополнительный урон оружия')) AS spec(kind,field,block)
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.data::jsonb->spec.field)='array' THEN i.data::jsonb->spec.field ELSE '[]'::jsonb END) e
  WHERE COALESCE(e->>'key','')<>''
  UNION ALL
  SELECT 'resource','Ресурс способности','',i.name,''
  WHERE i.type_id IN (3,4,7,18) AND (
   i.data::jsonb->>'max_use' IS NOT NULL OR i.data::jsonb->>'max_use_stat' IS NOT NULL
   OR i.data::jsonb->>'max_use_level_multiplier' IS NOT NULL
   OR i.data::jsonb->>'max_use_scaling'='true' OR i.data::jsonb->>'manual_size'='true')
  UNION ALL
  SELECT 'status','Эффект',i.data::jsonb->>'code',i.name,''
  WHERE i.type_id=15 AND COALESCE(i.data::jsonb->>'code','')<>''
  UNION ALL
  SELECT 'counter','Пункт меню действия',m->>'counter_key',m->>'title',m->>'value_id'
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.data::jsonb->'feature_actions')='array' THEN i.data::jsonb->'feature_actions' ELSE '[]'::jsonb END) a
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a->'menu_effects')='array' THEN a->'menu_effects' ELSE '[]'::jsonb END) m
  WHERE m->>'kind'='adjust_counter' AND COALESCE(m->>'counter_key','')<>'' AND COALESCE(m->>'value_id','')<>''
 ) r
 WHERE (i.user_id IS NULL OR i.user_id=$1) AND ($2::bigint=0 OR i.id=$2) AND i.id<>$3
)
SELECT DISTINCT id,name,kind,block,key,title,COALESCE(value_id,'') FROM refs
WHERE kind=$4 AND ($5='' OR key ILIKE '%'||$5||'%' OR title ILIKE '%'||$5||'%' OR name ILIKE '%'||$5||'%')
ORDER BY name,title,key LIMIT $6 OFFSET $7`

func (s *Store) FindItemRuleReferences(ctx context.Context, userID *int64, itemID, excludeID int64, kind, query string, limit, offset int) ([]ItemRuleReference, error) {
	rows, err := s.pool.Query(ctx, itemRuleReferencesSQL, userID, itemID, excludeID, kind, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ItemRuleReference{}
	for rows.Next() {
		var entry ItemRuleReference
		if err := rows.Scan(&entry.ItemID, &entry.ItemName, &entry.Kind, &entry.Block, &entry.Key, &entry.Title, &entry.ValueID); err != nil {
			return nil, err
		}
		result = append(result, entry)
	}
	return result, rows.Err()
}
