package store

// SQL fragments use internal aliases only. Potion links include choice variants
// and the selected spell effect, so the effect's source list stays complete.
func catalogueEffectLinksSQL(alias, viewer string) string {
	safeArray := func(expr string) string {
		return `CASE WHEN jsonb_typeof(` + expr + `)='array' THEN ` + expr + ` ELSE '[]'::jsonb END`
	}
	direct := safeArray(alias + `.data->'status_effects'`)
	choices := safeArray(alias + `.data#>'{consumption,choices}'`)
	return `(SELECT link,ordinal FROM jsonb_array_elements(` + direct + `) WITH ORDINALITY l(link,ordinal)
 UNION ALL SELECT link,ordinal FROM jsonb_array_elements(` + choices + `) c(choice)
 CROSS JOIN LATERAL jsonb_array_elements(` + safeArray(`choice->'status_effects'`) + `) WITH ORDINALITY l(link,ordinal)
 UNION ALL SELECT link,ordinal FROM dndshare.item spell
 CROSS JOIN LATERAL jsonb_array_elements(` + safeArray(`spell.data->'status_effects'`) + `) WITH ORDINALITY l(link,ordinal)
 WHERE spell.type_id=5 AND spell.id::text=` + alias + `.data#>>'{consumption,spell,id}'
 AND (spell.user_id IS NULL OR spell.user_id=` + viewer + `)
 AND (COALESCE(` + alias + `.data#>>'{consumption,spell_effect_key}','')='' OR link->>'key'=` + alias + `.data#>>'{consumption,spell_effect_key}'))`
}
