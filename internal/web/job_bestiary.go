package web

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"dndshare/internal/storage"
)

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
	maxBestiaryImageBytes         = 15 << 20
)

var bestiarySlugCleaner = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

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
				imageKey := ""
				imageURL := ""
				if upstreamImageURL := bestiaryImageURL(detail); upstreamImageURL != "" {
					stored, err := b.storeImage(ctx, upstreamImageURL, slug)
					if err != nil {
						errList = append(errList, fmt.Sprintf("%s image: %s", slug, err.Error()))
						jc.Increment(1, "Ошибка изображения: "+slug)
						return
					}
					imageKey, imageURL = stored.Key, stored.URL
				}

				exists, err := b.s.store.BestiaryFindItemByNameEn(ctx, bestiaryItemTypeEnemy, nameEng)
				if err != nil {
					errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
					jc.Increment(1, "Ошибка: "+slug)
					return
				}
				if exists {
					if err := b.s.store.BestiaryUpdateItem(ctx, nameEng, nameRus, mustMarshal(data), imageKey, imageURL, bestiaryItemTypeEnemy); err != nil {
						errList = append(errList, fmt.Sprintf("%s: %s", slug, err.Error()))
						jc.Increment(1, "Ошибка: "+slug)
						return
					}
					updated++
				} else {
					if _, err := b.s.store.BestiaryCreateItem(ctx, nameRus, nameEng, mustMarshal(data), imageKey, imageURL, bestiaryItemTypeEnemy); err != nil {
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

func bestiaryImageURL(d any) string {
	images, ok := asAnySlice(jPath(d, "images"))
	if !ok {
		return ""
	}
	for _, img := range images {
		if value := jStr(img, ""); strings.HasPrefix(value, ttgImagePrefix) {
			return value
		}
	}
	return ""
}

func (b *bestiaryImport) storeImage(ctx context.Context, sourceURL, slug string) (storage.StoredObject, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return storage.StoredObject{}, err
	}
	res, err := b.client.Do(req)
	if err != nil {
		return storage.StoredObject{}, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return storage.StoredObject{}, fmt.Errorf("download returned HTTP %d", res.StatusCode)
	}
	contentType := strings.TrimSpace(strings.Split(res.Header.Get("Content-Type"), ";")[0])
	if !strings.HasPrefix(contentType, "image/") {
		return storage.StoredObject{}, fmt.Errorf("download returned %q instead of an image", contentType)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, maxBestiaryImageBytes+1))
	if err != nil {
		return storage.StoredObject{}, err
	}
	if len(data) > maxBestiaryImageBytes {
		return storage.StoredObject{}, fmt.Errorf("image exceeds %d MiB", maxBestiaryImageBytes>>20)
	}
	ext := path.Ext(req.URL.Path)
	if len(ext) < 2 || len(ext) > 6 {
		ext = ".img"
	}
	cleanSlug := strings.Trim(bestiarySlugCleaner.ReplaceAllString(slug, "-"), "-")
	if cleanSlug == "" {
		return storage.StoredObject{}, fmt.Errorf("empty image slug")
	}
	key := "bestiary/v1/" + cleanSlug + strings.ToLower(ext)
	return b.s.s3.UploadBestiaryImage(ctx, bytes.NewReader(data), int64(len(data)), key, contentType)
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
