package web

import (
	"context"
	"encoding/json"
)

// Background-job handlers. Each job is registered in init().

func init() {
	registerJob("recount", "Пересчёт количеств в справочниках",
		"Обновляет count_items для item_type, source и suggest_type.", jobRecount)
	registerJob("bestiary-import", "Импорт бестиария",
		"Импортирует существ с ttg.club, копирует изображения в наш S3 и обновляет справочник врагов.", jobBestiaryImport)
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
