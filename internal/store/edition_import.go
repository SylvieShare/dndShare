package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Edition imports add concrete versions. Existing keys are immutable to this
// operation: subsequent editorial changes use the ordinary item editor/API.
type EditionImportRecord struct {
	Key              string         `json:"key"`
	Name             string         `json:"name"`
	NameEn           string         `json:"nameEn"`
	TypeID           int64          `json:"typeId"`
	OriginalID       *int64         `json:"originalId"`
	ParentKey        string         `json:"parentKey"`
	Data             map[string]any `json:"data"`
	AutomationStatus string         `json:"automationStatus"`
	AutomationNote   string         `json:"automationNote"`
}
type EditionImportDecision struct {
	ID     int64  `json:"id"`
	Status string `json:"status"`
	Note   string `json:"note"`
}
type EditionImportRequest struct {
	ContentSourceID int64                   `json:"contentSourceId"`
	SourceVersionID int64                   `json:"sourceVersionId"`
	Records         []EditionImportRecord   `json:"records"`
	Decisions       []EditionImportDecision `json:"decisions"`
	Reprints        []int64                 `json:"reprints"`
	References      map[string]int64        `json:"references"`
	Apply           bool                    `json:"apply"`
	PreviewToken    string                  `json:"previewToken"`
}
type EditionImportResult struct {
	Created   int              `json:"created"`
	Existing  int              `json:"existing"`
	Decisions int              `json:"decisions"`
	Applied   bool             `json:"applied"`
	Token     string           `json:"token"`
	IDs       map[string]int64 `json:"ids"`
}

func importHash(value any) string {
	raw, _ := json.Marshal(value)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
func importError(message string) error { return &RulesValidationError{Message: message} }
func resolveImportRefs(value any, ids map[string]int64) (any, error) {
	switch v := value.(type) {
	case map[string]any:
		if target, ok := v["$ref"]; ok {
			name, ok := target.(string)
			id, exists := ids[name]
			if !ok || !exists || len(v) != 1 {
				return nil, importError("Неизвестная ссылка импорта: " + fmt.Sprint(target))
			}
			return id, nil
		}
		out := map[string]any{}
		for k, x := range v {
			y, err := resolveImportRefs(x, ids)
			if err != nil {
				return nil, err
			}
			out[k] = y
		}
		return out, nil
	case []any:
		out := make([]any, len(v))
		for k, x := range v {
			y, err := resolveImportRefs(x, ids)
			if err != nil {
				return nil, err
			}
			out[k] = y
		}
		return out, nil
	default:
		return value, nil
	}
}
func (s *Store) ImportEdition(ctx context.Context, req EditionImportRequest) (EditionImportResult, error) {
	result := EditionImportResult{IDs: map[string]int64{}}
	if len(req.Records) == 0 || len(req.Records) > 2500 || len(req.Decisions) > 5000 || len(req.Reprints) > 2500 {
		return result, importError("Пакет: от 1 до 2500 новых версий и до 5000 решений")
	}
	keys := []string{}
	types := []int64{}
	originalIDs := []int64{}
	fingerprints := map[string]string{}
	recordTypes := map[string]int64{}
	for _, r := range req.Records {
		if r.Key == "" || len(r.Key) > 300 || strings.TrimSpace(r.Name) == "" || r.TypeID <= 0 || r.Data == nil {
			return result, importError("Некорректная запись пакета")
		}
		if _, exists := fingerprints[r.Key]; exists {
			return result, importError("Повтор ключа импорта: " + r.Key)
		}
		metadata := ItemMetadataPatch{AutomationStatus: &r.AutomationStatus, AutomationNote: &r.AutomationNote}
		if err := metadata.Validate(); err != nil {
			return result, err
		}
		recordTypes[r.Key] = r.TypeID
		fingerprints[r.Key] = importHash(r)
		keys = append(keys, r.Key)
		types = append(types, r.TypeID)
		if r.OriginalID != nil {
			originalIDs = append(originalIDs, *r.OriginalID)
		}
		result.IDs[r.Key] = -int64(len(keys))
	}
	originalIDs = append(originalIDs, req.Reprints...)
	for _, d := range req.Decisions {
		if d.ID <= 0 || (d.Status != "compatible" && d.Status != "requires_adaptation" && d.Status != "blocked") || len([]rune(d.Note)) > 1000 {
			return result, importError("Некорректное решение совместимости")
		}
		originalIDs = append(originalIDs, d.ID)
	}
	referenceTypes := map[string]int64{}
	for key, id := range req.References {
		parts := strings.SplitN(key, ":", 3)
		if len(parts) != 3 || parts[0] != "suggest" || parts[2] == "" || id <= 0 {
			return result, importError("Внешние ссылки пакета должны быть словарями")
		}
		typ, parseErr := strconv.ParseInt(parts[1], 10, 64)
		if parseErr != nil || typ <= 0 {
			return result, importError("Ссылка словаря: suggest:<тип>:<ключ>")
		}
		referenceTypes[key] = typ
		if _, exists := result.IDs[key]; exists {
			return result, importError("Коллизия ключа ссылки")
		}
		result.IDs[key] = id
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
		return result, err
	}
	var valid bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.content_source b JOIN dndshare.source_version v ON v.source_id=b.source_id WHERE b.id=$1 AND v.id=$2 AND b.native_source_version_id=v.id AND NOT EXISTS(SELECT 1 FROM unnest($3::bigint[]) t(id) LEFT JOIN dndshare.item_type it ON it.id=t.id WHERE it.source_id IS DISTINCT FROM v.source_id))`, req.ContentSourceID, req.SourceVersionID, types).Scan(&valid); err != nil {
		return result, err
	}
	if !valid {
		return result, importError("Публикация, редакция и типы пакета должны принадлежать одной системе")
	}
	for key, id := range req.References {
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.suggest s JOIN dndshare.suggest_type t ON t.id=s.type_id JOIN dndshare.source_version v ON v.source_id=t.source_id WHERE s.type_id=$1 AND s.id=$2 AND s.user_id IS NULL AND v.id=$3)`, referenceTypes[key], id, req.SourceVersionID).Scan(&valid); err != nil {
			return result, err
		}
		if !valid {
			return result, importError("Недоступная ссылка словаря: " + key)
		}
	}
	// Lock the original records and include their current data/decisions in the
	// token. Ordinary editors cannot change an original after this review starts.
	rows, err := tx.Query(ctx, `SELECT i.id,i.type_id,i.data::text,COALESCE(i.name_en,''),i.name,COALESCE(i.data->>'edition_key',''),COALESCE(i.data->>'import_fingerprint',''),COALESCE((SELECT jsonb_agg(c ORDER BY c.source_version_id)::text FROM dndshare.item_version_compatibility c WHERE c.item_id=i.id),'[]') FROM dndshare.item i JOIN dndshare.item_type t ON t.id=i.type_id JOIN dndshare.source_version v ON v.id=$3 AND v.source_id=t.source_id WHERE i.user_id IS NULL AND (i.id=ANY($1) OR i.data->>'edition_key'=ANY($2)) ORDER BY i.id FOR UPDATE OF i`, originalIDs, keys, req.SourceVersionID)
	if err != nil {
		return result, err
	}
	snapshot := []any{}
	defer rows.Close()
	originalTypes := map[int64]int64{}
	existing := map[string]bool{}
	for rows.Next() {
		var id, typ int64
		var data, en, name, key, fingerprint, decisions string
		if err = rows.Scan(&id, &typ, &data, &en, &name, &key, &fingerprint, &decisions); err != nil {
			rows.Close()
			return result, err
		}
		snapshot = append(snapshot, []any{id, typ, data, en, name, key, fingerprint, decisions})
		originalTypes[id] = typ
		if expected, ok := fingerprints[key]; ok {
			if expected != fingerprint {
				return result, importError("Ключ уже занят другой версией данных: " + key)
			}
			result.IDs[key] = id
			existing[key] = true
			result.Existing++
		}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return result, err
	}
	for _, id := range originalIDs {
		if _, ok := originalTypes[id]; !ok {
			return result, importError("Исходная запись недоступна для публикации")
		}
	}
	for _, r := range req.Records {
		if r.OriginalID != nil && originalTypes[*r.OriginalID] != r.TypeID {
			return result, importError("Исходная запись имеет другой тип")
		}
		if r.ParentKey != "" {
			if expected := map[int64]int64{16: 8, 17: 9}[r.TypeID]; expected == 0 || recordTypes[r.ParentKey] != expected {
				return result, importError("Родитель импорта должен быть базовым видом или классом: " + r.ParentKey)
			}
		}
		if _, err = resolveImportRefs(r.Data, result.IDs); err != nil {
			return result, err
		}
	}
	originalApply, originalToken := req.Apply, req.PreviewToken
	req.Apply = false
	req.PreviewToken = ""
	result.Token = importHash([]any{req, snapshot})
	result.Created = len(req.Records) - result.Existing
	result.Decisions = len(req.Decisions)
	if !originalApply {
		// Exercise the exact publication path, including SQL constraints and
		// parent triggers, then roll back. Sequence gaps are intentional.
		validation := result
		validation.IDs = map[string]int64{}
		for key, id := range result.IDs {
			validation.IDs[key] = id
		}
		if err = applyEditionImport(ctx, tx, req, existing, fingerprints, &validation); err != nil {
			return result, err
		}
		return result, nil
	}
	if originalToken == "" || originalToken != result.Token {
		return result, importError("Пакет или исходные данные изменились; повторите предварительный просмотр")
	}
	if err = applyEditionImport(ctx, tx, req, existing, fingerprints, &result); err != nil {
		return result, err
	}
	if err = tx.Commit(ctx); err != nil {
		return result, err
	}
	result.Applied = true
	return result, nil
}
