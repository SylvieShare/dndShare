package store

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type legacyRichMigrationStats struct {
	Items        int
	DiceNodes    int
	DiceAverages int
	ItemNodes    int
	SuggestNodes int
	NativeLinks  int
}

type legacyRichConversion struct {
	DiceNodes    int
	DiceAverages int
	ItemNodes    int
	SuggestNodes int
	NativeLinks  int
}

func migrateLegacyRichContent(ctx context.Context, tx pgx.Tx) (legacyRichMigrationStats, error) {
	// v2 additionally recognizes imported /condition(s)/... links. A new marker
	// makes the narrow idempotent pass run on databases that already applied v1.
	const migrationCode = "legacy-rich-content-v2"
	var applied bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM dndshare.schema_data_migration WHERE code = $1
	)`, migrationCode).Scan(&applied); err != nil {
		return legacyRichMigrationStats{}, fmt.Errorf("check legacy rich content marker: %w", err)
	}
	if applied {
		return legacyRichMigrationStats{}, nil
	}
	resolver, err := loadLegacyRichResolver(ctx, tx)
	if err != nil {
		return legacyRichMigrationStats{}, err
	}
	rows, err := tx.Query(ctx, `SELECT id, data FROM dndshare.item WHERE data::text LIKE '%<%' ORDER BY id`)
	if err != nil {
		return legacyRichMigrationStats{}, fmt.Errorf("query legacy rich content: %w", err)
	}
	type itemData struct {
		id   int64
		data []byte
	}
	items := []itemData{}
	for rows.Next() {
		var item itemData
		if err := rows.Scan(&item.id, &item.data); err != nil {
			rows.Close()
			return legacyRichMigrationStats{}, fmt.Errorf("scan legacy rich content: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return legacyRichMigrationStats{}, fmt.Errorf("read legacy rich content: %w", err)
	}
	rows.Close()

	stats := legacyRichMigrationStats{}
	for _, item := range items {
		decoder := json.NewDecoder(bytes.NewReader(item.data))
		decoder.UseNumber()
		var value any
		if err := decoder.Decode(&value); err != nil {
			return stats, fmt.Errorf("decode item %d rich content: %w", item.id, err)
		}
		conversion := legacyRichConversion{}
		changed, err := convertLegacyRichJSON(value, resolver, &conversion)
		if err != nil {
			return stats, fmt.Errorf("convert item %d rich content: %w", item.id, err)
		}
		if !changed {
			continue
		}
		encoded, err := json.Marshal(value)
		if err != nil {
			return stats, fmt.Errorf("encode item %d rich content: %w", item.id, err)
		}
		if _, err := tx.Exec(ctx, `UPDATE dndshare.item SET data = $2::jsonb WHERE id = $1`, item.id, string(encoded)); err != nil {
			return stats, fmt.Errorf("save item %d rich content: %w", item.id, err)
		}
		stats.Items++
		stats.DiceNodes += conversion.DiceNodes
		stats.DiceAverages += conversion.DiceAverages
		stats.ItemNodes += conversion.ItemNodes
		stats.SuggestNodes += conversion.SuggestNodes
		stats.NativeLinks += conversion.NativeLinks
	}
	if stats.Items > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO dndshare.schema_data_migration (code) VALUES ($1) ON CONFLICT (code) DO NOTHING`, migrationCode); err != nil {
			return stats, fmt.Errorf("save legacy rich content marker: %w", err)
		}
	}
	return stats, nil
}

func loadLegacyRichResolver(ctx context.Context, tx pgx.Tx) (*legacyRichResolver, error) {
	itemRows, err := tx.Query(ctx, `SELECT id, type_id, name, COALESCE(name_en, '') FROM dndshare.item WHERE user_id IS NULL ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("query rich item references: %w", err)
	}
	items := []legacyRichItemRef{}
	for itemRows.Next() {
		var item legacyRichItemRef
		if err := itemRows.Scan(&item.ID, &item.TypeID, &item.Name, &item.NameEn); err != nil {
			itemRows.Close()
			return nil, fmt.Errorf("scan rich item reference: %w", err)
		}
		items = append(items, item)
	}
	if err := itemRows.Err(); err != nil {
		itemRows.Close()
		return nil, fmt.Errorf("read rich item references: %w", err)
	}
	itemRows.Close()

	suggestRows, err := tx.Query(ctx, `SELECT id, type_id, value, COALESCE(code, '') FROM dndshare.suggest WHERE user_id IS NULL ORDER BY type_id, id`)
	if err != nil {
		return nil, fmt.Errorf("query rich suggest references: %w", err)
	}
	suggests := []legacyRichSuggestRef{}
	for suggestRows.Next() {
		var suggest legacyRichSuggestRef
		if err := suggestRows.Scan(&suggest.ID, &suggest.TypeID, &suggest.Value, &suggest.Code); err != nil {
			suggestRows.Close()
			return nil, fmt.Errorf("scan rich suggest reference: %w", err)
		}
		suggests = append(suggests, suggest)
	}
	if err := suggestRows.Err(); err != nil {
		suggestRows.Close()
		return nil, fmt.Errorf("read rich suggest references: %w", err)
	}
	suggestRows.Close()
	return newLegacyRichResolver(items, suggests), nil
}

func convertLegacyRichJSON(value any, resolver *legacyRichResolver, conversion *legacyRichConversion) (bool, error) {
	changed := false
	switch typed := value.(type) {
	case map[string]any:
		for key, entry := range typed {
			if text, ok := entry.(string); ok {
				converted, didChange, err := convertLegacyRichHTML(text, resolver, conversion)
				if err != nil {
					return false, err
				}
				if didChange {
					typed[key] = converted
					changed = true
				}
				continue
			}
			didChange, err := convertLegacyRichJSON(entry, resolver, conversion)
			if err != nil {
				return false, err
			}
			changed = changed || didChange
		}
	case []any:
		for index, entry := range typed {
			if text, ok := entry.(string); ok {
				converted, didChange, err := convertLegacyRichHTML(text, resolver, conversion)
				if err != nil {
					return false, err
				}
				if didChange {
					typed[index] = converted
					changed = true
				}
				continue
			}
			didChange, err := convertLegacyRichJSON(entry, resolver, conversion)
			if err != nil {
				return false, err
			}
			changed = changed || didChange
		}
	}
	return changed, nil
}
