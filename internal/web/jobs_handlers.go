package web

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Background-job handlers. Each job is registered in init().

func init() {
	registerJob("recount", "Пересчёт количеств в справочниках",
		"Обновляет count_items для item_type, source и suggest_type.", jobRecount)
	registerJob("bestiary-import", "Импорт бестиария",
		"Импортирует существ с ttg.club в справочник врагов.", jobBestiaryImport)
}

// --- shared json helpers (порт обращений к Map/JsonNode) ---

func parseJSONMap(raw json.RawMessage) (map[string]any, bool) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil || m == nil {
		return nil, false
	}
	return m, true
}

func asAnySlice(v any) ([]any, bool) {
	s, ok := v.([]any)
	return s, ok
}

func asAnyMap(v any) (map[string]any, bool) {
	m, ok := v.(map[string]any)
	return m, ok
}

func asLong(v any) (int64, bool) {
	switch n := v.(type) {
	case float64:
		return int64(n), true
	case json.Number:
		i, err := n.Int64()
		return i, err == nil
	}
	return 0, false
}

func mustMarshal(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

// ============================= recount =============================

func jobRecount(s *Server, jc *JobContext) error {
	ctx := context.Background()
	jc.SetTotal(3)

	jc.Progress(0, "Пересчёт item_type")
	if err := jc.CheckCancelled(); err != nil {
		return err
	}
	if err := s.store.RecountItemTypes(ctx); err != nil {
		return err
	}

	jc.Progress(1, "Пересчёт source")
	if err := jc.CheckCancelled(); err != nil {
		return err
	}
	if err := s.store.RecountSources(ctx); err != nil {
		return err
	}

	jc.Progress(2, "Пересчёт suggest_type")
	if err := jc.CheckCancelled(); err != nil {
		return err
	}
	if err := s.store.RecountSuggestTypes(ctx); err != nil {
		return err
	}

	jc.Progress(3, "Готово")
	jc.SetResult(map[string]any{"ok": true})
	return nil
}

// ===================== bestiary-import =====================

const (
	bestiaryItemTypeEnemy         = int64(6)
	bestiarySuggestTypeSize       = int64(18)
	bestiarySuggestTypeCreature   = int64(19)
	bestiarySuggestTypeEnvironmnt = int64(21)
	bestiarySuggestTypeTag        = int64(22)
	ttgBase                       = "https://5e14.ttg.club/api/v1"
	ttgImagePrefix                = "https://img.ttg.club/creatures/"
	bestiaryPageSize              = 160
	tagNamedNPC                   = "Именованные НИП"
)

var bestiaryTagsSkip = map[string]struct{}{
	"Именованные НИП": {},
	"Гуманоиды":       {},
}

type bestiaryImportResult struct {
	Imported      int      `json:"imported"`
	Updated       int      `json:"updated"`
	Errors        []string `json:"errors"`
	MultipleSizes []string `json:"multipleSizes"`
}

type bestiaryImport struct {
	s      *Server
	client *http.Client
}

func jobBestiaryImport(s *Server, jc *JobContext) error {
	b := &bestiaryImport{s: s, client: &http.Client{Timeout: 30 * time.Second}}
	ctx := context.Background()

	imported := 0
	updated := 0
	errList := []string{}
	multipleSizes := []string{}
	page := 0

	for {
		if err := jc.CheckCancelled(); err != nil {
			return err
		}
		listNode, err := b.sendPost(fmt.Sprintf("%s/bestiary", ttgBase), map[string]any{
			"page":   page,
			"size":   bestiaryPageSize,
			"search": map[string]any{"value": "", "exact": false},
			"order": []any{
				map[string]any{"field": "exp", "direction": "asc"},
				map[string]any{"field": "name", "direction": "asc"},
			},
		})
		if err != nil {
			return err
		}
		items, ok := asAnySlice(listNode)
		if !ok {
			break
		}
		if len(items) == 0 {
			break
		}

		for _, item := range items {
			if err := jc.CheckCancelled(); err != nil {
				return err
			}
			im, ok := asAnyMap(item)
			if !ok {
				continue
			}
			urlPath := jStr(im["url"], "")
			if urlPath == "" {
				continue
			}
			slug := strings.TrimPrefix(urlPath, "/bestiary/")
			nameEng := jStr(jPath(im, "name", "eng"), slug)

			func() {
				time.Sleep(200 * time.Millisecond)
				detail, err := b.sendPost(fmt.Sprintf("%s/bestiary/%s", ttgBase, slug), nil)
				if err != nil {
					errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
					jc.Increment(1, "Ошибка: "+slug)
					return
				}
				nameRus := jStr(jPath(detail, "name", "rus"), nameEng)
				sizeIds, err := b.resolveSizeIds(ctx, detail, &multipleSizes, nameEng)
				if err != nil {
					errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
					jc.Increment(1, "Ошибка: "+slug)
					return
				}
				data, err := b.mapCreatureToData(ctx, detail, sizeIds)
				if err != nil {
					errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
					jc.Increment(1, "Ошибка: "+slug)
					return
				}

				exists, err := b.s.store.BestiaryFindItemByNameEn(ctx, bestiaryItemTypeEnemy, nameEng)
				if err != nil {
					errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
					jc.Increment(1, "Ошибка: "+slug)
					return
				}
				if exists {
					if err := b.s.store.BestiaryUpdateItem(ctx, nameEng, nameRus, mustMarshal(data), bestiaryItemTypeEnemy); err != nil {
						errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
						jc.Increment(1, "Ошибка: "+slug)
						return
					}
					updated++
				} else {
					if _, err := b.s.store.BestiaryCreateItem(ctx, nameRus, nameEng, mustMarshal(data), bestiaryItemTypeEnemy); err != nil {
						errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
						jc.Increment(1, "Ошибка: "+slug)
						return
					}
					imported++
				}
				jc.Increment(1, "Импорт: "+nameEng)
			}()
		}

		if len(items) < bestiaryPageSize {
			break
		}
		page++
	}

	jc.SetResult(bestiaryImportResult{
		Imported:      imported,
		Updated:       updated,
		Errors:        errList,
		MultipleSizes: multipleSizes,
	})
	return nil
}

func (b *bestiaryImport) resolveSizeIds(ctx context.Context, d any, multipleSizes *[]string, nameEng string) ([]int64, error) {
	sizeNode := jPath(d, "size")
	engRaw := strings.TrimSpace(jStr(jPath(sizeNode, "eng"), ""))
	rusRaw := strings.TrimSpace(jStr(jPath(sizeNode, "rus"), ""))
	if engRaw == "" {
		return nil, nil
	}
	engParts := splitTrimNonBlank(engRaw, " or ")
	rusParts := splitTrimNonBlank(rusRaw, " или ")

	if len(engParts) > 1 {
		*multipleSizes = append(*multipleSizes, fmt.Sprintf("%s (size: %s)", nameEng, rusRaw))
	}

	out := make([]int64, 0, len(engParts))
	for i, eng := range engParts {
		rus := eng
		if i < len(rusParts) {
			rus = rusParts[i]
		}
		id, err := b.getOrCreateSuggestByCode(ctx, bestiarySuggestTypeSize, rus, eng)
		if err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}

func (b *bestiaryImport) mapCreatureToData(ctx context.Context, d any, sizeIds []int64) (map[string]any, error) {
	data := map[string]any{}
	identity := map[string]any{}

	if len(sizeIds) > 0 {
		identity["size"] = sizeIds
	}

	creatureType := jStr(jPath(d, "type", "name"), "")
	if creatureType != "" {
		id, err := b.getOrCreateSuggestByValue(ctx, bestiarySuggestTypeCreature, creatureType)
		if err != nil {
			return nil, err
		}
		identity["creature_type"] = []any{id}
	}

	alignment := jStr(jPath(d, "alignment"), "")
	if alignment != "" {
		identity["alignment"] = alignment
	}

	tagsNode, _ := asAnySlice(jPath(d, "tags"))
	tagNames := map[string]struct{}{}
	for _, t := range tagsNode {
		if n := jStr(jPath(t, "name"), ""); n != "" {
			tagNames[n] = struct{}{}
		}
	}

	identity["is_legendary"] = hasNonNull(d, "legendary")
	if _, ok := tagNames[tagNamedNPC]; ok {
		identity["named_npc"] = true
	}

	tagIds := []any{}
	for _, tagNode := range tagsNode {
		name := jStr(jPath(tagNode, "name"), "")
		if _, skip := bestiaryTagsSkip[name]; skip {
			continue
		}
		if name == "" {
			continue
		}
		var descPtr *string
		if desc := jStr(jPath(tagNode, "description"), ""); desc != "" {
			descPtr = &desc
		}
		id, err := b.getOrCreateSuggestByValueWithDesc(ctx, bestiarySuggestTypeTag, name, descPtr)
		if err != nil {
			return nil, err
		}
		tagIds = append(tagIds, id)
	}
	if len(tagIds) > 0 {
		data["tags"] = tagIds
	}

	source := jStr(jPath(d, "source", "shortName"), "")
	if source != "" {
		identity["source"] = source
	}

	environmentIds, err := b.resolveEnvironmentIds(ctx, jPath(d, "environment"))
	if err != nil {
		return nil, err
	}
	if len(environmentIds) > 0 {
		identity["environment"] = environmentIds
	}

	if len(identity) > 0 {
		data["identity"] = identity
	}

	combat := map[string]any{}
	if ac := jInt(jPath(d, "armorClass"), 0); ac > 0 {
		combat["ac"] = ac
	}
	if pb, err := strconv.Atoi(strings.TrimSpace(jStr(jPath(d, "proficiencyBonus"), ""))); err == nil && pb > 0 {
		combat["proficiencyBonus"] = pb
	}
	if acNote := joinNamesNonBlank(jPath(d, "armors")); acNote != "" {
		combat["ac_note"] = acNote
	}
	hitsNode := jPath(d, "hits")
	if hpAvg := jInt(jPath(hitsNode, "average"), 0); hpAvg > 0 {
		combat["hp"] = hpAvg
	}
	if hpFormula := buildHpFormula(hitsNode); hpFormula != "" {
		combat["hp_formula"] = hpFormula
	}
	speedText, speedOpt := buildSpeedData(jPath(d, "speed"))
	if speedText != "" {
		combat["speed"] = speedText
	}
	if len(speedOpt) > 0 {
		combat["speed_opt"] = speedOpt
	}
	if cr := jStr(jPath(d, "challengeRating"), ""); cr != "" && cr != "—" {
		combat["cr"] = cr
	}
	if xp := jInt(jPath(d, "experience"), 0); xp > 0 {
		combat["xp"] = xp
	}
	if len(combat) > 0 {
		data["combat"] = combat
	}

	ability := jPath(d, "ability")
	stats := map[string]any{}
	for _, stat := range []string{"str", "dex", "con", "int", "cha"} {
		if v := jInt(jPath(ability, stat), 0); v > 0 {
			stats[stat] = v
		}
	}
	if wis := jInt(jPath(ability, "wiz"), 0); wis > 0 {
		stats["wis"] = wis
	}
	if len(stats) > 0 {
		data["stats"] = stats
	}

	if savingThrows, ok := asAnySlice(jPath(d, "savingThrows")); ok {
		saves := map[string]any{}
		for _, s := range savingThrows {
			key := mapSaveShortNameToKey(jStr(jPath(s, "shortName"), ""))
			if key == "" {
				continue
			}
			saves[key] = jInt(jPath(s, "value"), 0)
		}
		if len(saves) > 0 {
			data["saving_throws"] = saves
		}
	}

	if skills := buildStatList(jPath(d, "skills"), false); skills != "" {
		data["skills"] = skills
	}
	if v := joinStringArray(jPath(d, "damageImmunities")); v != "" {
		data["damage_immunities"] = v
	}
	if v := joinStringArray(jPath(d, "damageResistances")); v != "" {
		data["damage_resistances"] = v
	}
	if v := joinStringArray(jPath(d, "conditionImmunities")); v != "" {
		data["condition_immunities"] = v
	}
	if senses := buildSenses(jPath(d, "senses")); senses != "" {
		data["senses"] = senses
	}

	var languages string
	langNode := jPath(d, "languages")
	if arr, ok := asAnySlice(langNode); ok {
		parts := []string{}
		for _, l := range arr {
			if s := jStr(l, ""); s != "" {
				parts = append(parts, s)
			}
		}
		languages = strings.Join(parts, ", ")
	} else if s, ok := langNode.(string); ok {
		languages = s
	}
	if languages != "" {
		data["languages"] = languages
	}

	if description := jStr(jPath(d, "description"), ""); description != "" {
		data["description"] = description
	}

	if images, ok := asAnySlice(jPath(d, "images")); ok {
		for _, img := range images {
			if s := jStr(img, ""); strings.HasPrefix(s, ttgImagePrefix) {
				data["image_url"] = s
				break
			}
		}
	}

	if feats := buildBlocks(jPath(d, "feats")); len(feats) > 0 {
		data["feats"] = feats
	}
	if actions := buildBlocks(jPath(d, "actions")); len(actions) > 0 {
		data["actions"] = actions
	}
	if reactions := buildBlocks(jPath(d, "reactions")); len(reactions) > 0 {
		data["reactions"] = reactions
	}

	return data, nil
}

func (b *bestiaryImport) getOrCreateSuggestByCode(ctx context.Context, typeID int64, value, code string) (int64, error) {
	id, found, err := b.s.store.BestiaryFindSuggestByCode(ctx, typeID, code)
	if err != nil {
		return 0, err
	}
	if found {
		return id, nil
	}
	return b.s.store.BestiaryAddSuggest(ctx, typeID, value, &code, nil)
}

func (b *bestiaryImport) getOrCreateSuggestByValue(ctx context.Context, typeID int64, value string) (int64, error) {
	return b.getOrCreateSuggestByValueWithDesc(ctx, typeID, value, nil)
}

func (b *bestiaryImport) getOrCreateSuggestByValueWithDesc(ctx context.Context, typeID int64, value string, desc *string) (int64, error) {
	id, found, err := b.s.store.BestiaryFindSuggestByValue(ctx, typeID, value)
	if err != nil {
		return 0, err
	}
	if found {
		return id, nil
	}
	return b.s.store.BestiaryAddSuggest(ctx, typeID, value, nil, desc)
}

func (b *bestiaryImport) resolveEnvironmentIds(ctx context.Context, node any) ([]int64, error) {
	arr, ok := asAnySlice(node)
	if !ok {
		return nil, nil
	}
	out := []int64{}
	for _, el := range arr {
		for _, part := range splitTrimNonBlank(jStr(el, ""), ",") {
			id, err := b.getOrCreateSuggestByValue(ctx, bestiarySuggestTypeEnvironmnt, part)
			if err != nil {
				return nil, err
			}
			out = append(out, id)
		}
	}
	return out, nil
}

func (b *bestiaryImport) sendPost(url string, body any) (any, error) {
	var reqBody []byte
	if body != nil {
		reqBody, _ = json.Marshal(body)
	}
	delayMs := 500
	for i := 0; i < 5; i++ {
		var bodyReader io.Reader
		if reqBody != nil {
			bodyReader = bytes.NewReader(reqBody)
		}
		req, err := http.NewRequest(http.MethodPost, url, bodyReader)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := b.client.Do(req)
		if err != nil {
			return nil, err
		}
		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			time.Sleep(time.Duration(delayMs) * time.Millisecond)
			delayMs *= 2
			continue
		}
		if resp.StatusCode/100 != 2 {
			return nil, fmt.Errorf("%s: unexpected status %d", url, resp.StatusCode)
		}
		var node any
		if err := json.Unmarshal(respBody, &node); err != nil {
			return nil, err
		}
		return node, nil
	}
	return nil, fmt.Errorf("too many retries for %s", url)
}

// --- bestiary pure helpers (порт JsonNode-хелперов) ---

func mapSaveShortNameToKey(shortName string) string {
	s := strings.TrimRight(strings.ToLower(strings.TrimSpace(shortName)), ".")
	switch s {
	case "сил":
		return "str"
	case "лвк", "лов":
		return "dex"
	case "тел":
		return "con"
	case "инт":
		return "int"
	case "мдр":
		return "wis"
	case "хар":
		return "cha"
	case "str", "dex", "con", "int", "wis", "cha":
		return s
	}
	return ""
}

func buildHpFormula(hits any) string {
	formula := jStr(jPath(hits, "formula"), "")
	if formula == "" {
		return ""
	}
	sign := strings.TrimSpace(jStr(jPath(hits, "sign"), ""))
	bonus := jInt(jPath(hits, "bonus"), 0)
	if bonus != 0 {
		if bonus < 0 {
			bonus = -bonus
		}
		return fmt.Sprintf("%s %s %d", formula, sign, bonus)
	}
	return formula
}

func buildSpeedData(speedNode any) (string, []any) {
	arr, ok := asAnySlice(speedNode)
	if !ok {
		return "", nil
	}
	opts := make([]any, 0, len(arr))
	parts := make([]string, 0, len(arr))
	for _, s := range arr {
		name := jStr(jPath(s, "name"), "")
		value := jInt(jPath(s, "value"), 0)
		opts = append(opts, map[string]any{"name": name, "value": value})
		if name == "" {
			parts = append(parts, fmt.Sprintf("%d фт.", value))
		} else {
			parts = append(parts, fmt.Sprintf("%s %d фт.", name, value))
		}
	}
	return strings.Join(parts, ", "), opts
}

func buildStatList(node any, useShortName bool) string {
	arr, ok := asAnySlice(node)
	if !ok {
		return ""
	}
	parts := make([]string, 0, len(arr))
	for _, s := range arr {
		var name string
		if useShortName {
			name = jStr(jPath(s, "shortName"), jStr(jPath(s, "name"), ""))
		} else {
			name = jStr(jPath(s, "name"), "")
		}
		value := jInt(jPath(s, "value"), 0)
		if value >= 0 {
			parts = append(parts, fmt.Sprintf("%s +%d", name, value))
		} else {
			parts = append(parts, fmt.Sprintf("%s %d", name, value))
		}
	}
	return strings.Join(parts, ", ")
}

func buildSenses(node any) string {
	if _, ok := asAnyMap(node); !ok {
		return ""
	}
	parts := []string{}
	if senses, ok := asAnySlice(jPath(node, "senses")); ok {
		for _, s := range senses {
			name := jStr(jPath(s, "name"), "")
			value := jInt(jPath(s, "value"), 0)
			if name != "" {
				parts = append(parts, fmt.Sprintf("%s %d фт.", name, value))
			}
		}
	}
	if passive := jStr(jPath(node, "passivePerception"), ""); passive != "" {
		parts = append(parts, "пассивное Внимательность "+passive)
	}
	return strings.Join(parts, ", ")
}

func buildBlocks(node any) []any {
	arr, ok := asAnySlice(node)
	if !ok {
		return nil
	}
	out := []any{}
	for _, a := range arr {
		name := jStr(jPath(a, "name"), "")
		value := jStr(jPath(a, "value"), "")
		if name == "" && value == "" {
			continue
		}
		out = append(out, map[string]any{"name": name, "value": value})
	}
	return out
}

func joinStringArray(node any) string {
	arr, ok := asAnySlice(node)
	if !ok {
		return ""
	}
	parts := []string{}
	for _, el := range arr {
		if s := jStr(el, ""); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, ", ")
}

func joinNamesNonBlank(node any) string {
	arr, ok := asAnySlice(node)
	if !ok {
		return ""
	}
	parts := []string{}
	for _, el := range arr {
		if s := jStr(jPath(el, "name"), ""); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, ", ")
}

func splitTrimNonBlank(s, sep string) []string {
	out := []string{}
	for _, part := range strings.Split(s, sep) {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// --- generic JsonNode-like accessors over map[string]any decoded json ---

func jPath(node any, keys ...string) any {
	cur := node
	for _, k := range keys {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = m[k]
	}
	return cur
}

func jStr(node any, def string) string {
	switch v := node.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	}
	return def
}

func jInt(node any, def int) int {
	switch v := node.(type) {
	case float64:
		return int(v)
	case string:
		if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			return n
		}
	}
	return def
}

func hasNonNull(node any, key string) bool {
	m, ok := node.(map[string]any)
	if !ok {
		return false
	}
	v, present := m[key]
	return present && v != nil
}
