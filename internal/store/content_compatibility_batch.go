package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

type CompatibilityPreviewItem struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}
type CompatibilityPreview struct {
	Items   []CompatibilityPreviewItem `json:"items"`
	Token   string                     `json:"token"`
	Skipped int64                      `json:"skipped"`
	Applied bool                       `json:"applied"`
}

// ReviewPublicationCompatibility only fills absent decisions. Existing overrides
// and replacements survive bulk review, including an explicit blocked status.
func (s *Store) ReviewPublicationCompatibility(ctx context.Context, bookID, editionID int64, status, token string, apply bool) (CompatibilityPreview, error) {
	result := CompatibilityPreview{Items: []CompatibilityPreviewItem{}}
	if status != "compatible" && status != "requires_adaptation" && status != "blocked" {
		return result, &RulesValidationError{Message: "Для пакета выберите совместимость, адаптацию или недоступность"}
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
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.content_source s JOIN dndshare.source_version v ON v.source_id=s.source_id WHERE s.id=$1 AND v.id=$2)`, bookID, editionID).Scan(&valid); err != nil {
		return result, err
	}
	if !valid {
		return result, ErrNotFound
	}
	rows, err := tx.Query(ctx, `SELECT i.id,i.name,i.data::text,COALESCE(c.status,'') FROM dndshare.item i
 JOIN dndshare.item_content_source b ON b.item_id=i.id AND b.content_source_id=$1
 LEFT JOIN dndshare.item_version_compatibility c ON c.item_id=i.id AND c.source_version_id=$2
 WHERE i.user_id IS NULL AND NOT i.hidden ORDER BY i.id FOR UPDATE OF i`, bookID, editionID)
	if err != nil {
		return result, err
	}
	hash := sha256.New()
	fmt.Fprintf(hash, "%d/%d/%s\n", bookID, editionID, status)
	for rows.Next() {
		var id int64
		var name, data, current string
		if err = rows.Scan(&id, &name, &data, &current); err != nil {
			rows.Close()
			return result, err
		}
		fmt.Fprintf(hash, "%d:%s:%s:%s\n", id, name, data, current)
		if current != "" {
			result.Skipped++
			continue
		}
		result.Items = append(result.Items, CompatibilityPreviewItem{ID: id, Name: name})
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return result, err
	}
	result.Token = hex.EncodeToString(hash.Sum(nil))
	if !apply {
		return result, nil
	}
	if token == "" || token != result.Token {
		return result, &RulesValidationError{Message: "Состав или механика источника изменились: обновите предварительный просмотр"}
	}
	for _, item := range result.Items {
		if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status,note) VALUES($1,$2,$3,'Пакетная проверка публикации') ON CONFLICT DO NOTHING`, item.ID, editionID, status); err != nil {
			return result, err
		}
	}
	ids := make([]int64, len(result.Items))
	for index, item := range result.Items {
		ids[index] = item.ID
	}
	if err = validateParentEditions(ctx, tx, ids); err != nil {
		return result, err
	}
	if err = tx.Commit(ctx); err != nil {
		return result, err
	}
	result.Applied = true
	return result, nil
}
