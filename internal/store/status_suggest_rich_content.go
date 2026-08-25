package store

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

type statusSuggestRichMigrationStats struct {
	Items int
	Nodes int
}

func migrateStatusSuggestRichContent(ctx context.Context, tx pgx.Tx) (statusSuggestRichMigrationStats, error) {
	rows, err := tx.Query(ctx, `
		SELECT suggest.id, effect.id
		FROM dndshare.suggest suggest
		JOIN dndshare.item effect
		  ON effect.type_id = 15
		 AND effect.user_id IS NOT DISTINCT FROM suggest.user_id
		 AND effect.data ->> 'legacy_suggest_id' = suggest.id::text
		WHERE suggest.type_id = 9`)
	if err != nil {
		return statusSuggestRichMigrationStats{}, fmt.Errorf("query status suggest item mapping: %w", err)
	}
	mapping := map[int64]int64{}
	for rows.Next() {
		var suggestID, itemID int64
		if err := rows.Scan(&suggestID, &itemID); err != nil {
			rows.Close()
			return statusSuggestRichMigrationStats{}, fmt.Errorf("scan status suggest item mapping: %w", err)
		}
		mapping[suggestID] = itemID
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return statusSuggestRichMigrationStats{}, fmt.Errorf("read status suggest item mapping: %w", err)
	}
	rows.Close()
	if len(mapping) == 0 {
		return statusSuggestRichMigrationStats{}, nil
	}

	itemRows, err := tx.Query(ctx, `
		SELECT id, data
		FROM dndshare.item
		WHERE data::text LIKE '%data-rich-node%'
		ORDER BY id`)
	if err != nil {
		return statusSuggestRichMigrationStats{}, fmt.Errorf("query status rich references: %w", err)
	}
	type itemData struct {
		id   int64
		data []byte
	}
	items := []itemData{}
	for itemRows.Next() {
		var item itemData
		if err := itemRows.Scan(&item.id, &item.data); err != nil {
			itemRows.Close()
			return statusSuggestRichMigrationStats{}, fmt.Errorf("scan status rich references: %w", err)
		}
		items = append(items, item)
	}
	if err := itemRows.Err(); err != nil {
		itemRows.Close()
		return statusSuggestRichMigrationStats{}, fmt.Errorf("read status rich references: %w", err)
	}
	itemRows.Close()

	stats := statusSuggestRichMigrationStats{}
	for _, item := range items {
		var value any
		decoder := json.NewDecoder(bytes.NewReader(item.data))
		decoder.UseNumber()
		if err := decoder.Decode(&value); err != nil {
			return stats, fmt.Errorf("decode item %d status rich references: %w", item.id, err)
		}
		nodes := 0
		changed, err := rewriteStatusSuggestJSON(value, mapping, &nodes)
		if err != nil {
			return stats, fmt.Errorf("rewrite item %d status rich references: %w", item.id, err)
		}
		if !changed {
			continue
		}
		encoded, err := json.Marshal(value)
		if err != nil {
			return stats, fmt.Errorf("encode item %d status rich references: %w", item.id, err)
		}
		if _, err := tx.Exec(ctx, `UPDATE dndshare.item SET data = $2::jsonb WHERE id = $1`, item.id, string(encoded)); err != nil {
			return stats, fmt.Errorf("save item %d status rich references: %w", item.id, err)
		}
		stats.Items++
		stats.Nodes += nodes
	}
	return stats, nil
}

func rewriteStatusSuggestJSON(value any, mapping map[int64]int64, nodes *int) (bool, error) {
	changed := false
	switch typed := value.(type) {
	case map[string]any:
		for key, entry := range typed {
			if text, ok := entry.(string); ok {
				converted, didChange, err := rewriteStatusSuggestHTML(text, mapping, nodes)
				if err != nil {
					return false, err
				}
				if didChange {
					typed[key] = converted
					changed = true
				}
				continue
			}
			didChange, err := rewriteStatusSuggestJSON(entry, mapping, nodes)
			if err != nil {
				return false, err
			}
			changed = changed || didChange
		}
	case []any:
		for index, entry := range typed {
			if text, ok := entry.(string); ok {
				converted, didChange, err := rewriteStatusSuggestHTML(text, mapping, nodes)
				if err != nil {
					return false, err
				}
				if didChange {
					typed[index] = converted
					changed = true
				}
				continue
			}
			didChange, err := rewriteStatusSuggestJSON(entry, mapping, nodes)
			if err != nil {
				return false, err
			}
			changed = changed || didChange
		}
	}
	return changed, nil
}

func rewriteStatusSuggestHTML(source string, mapping map[int64]int64, nodes *int) (string, bool, error) {
	if !strings.Contains(source, `data-rich-node="suggest"`) {
		return source, false, nil
	}
	contextNode := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	parsed, err := html.ParseFragment(strings.NewReader(source), contextNode)
	if err != nil {
		return source, false, fmt.Errorf("parse status rich html: %w", err)
	}
	root := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	for _, node := range parsed {
		root.AppendChild(node)
	}
	changed := rewriteStatusSuggestNodes(root, mapping, nodes)
	if !changed {
		return source, false, nil
	}
	var output bytes.Buffer
	for child := root.FirstChild; child != nil; child = child.NextSibling {
		if err := html.Render(&output, child); err != nil {
			return source, false, fmt.Errorf("render status rich html: %w", err)
		}
	}
	return output.String(), true, nil
}

func rewriteStatusSuggestNodes(parent *html.Node, mapping map[int64]int64, nodes *int) bool {
	changed := false
	for node := parent.FirstChild; node != nil; node = node.NextSibling {
		if node.Type != html.ElementNode {
			continue
		}
		if strings.EqualFold(htmlAttr(node, "data-rich-node"), "suggest") {
			var payload struct {
				ID     int64 `json:"id"`
				TypeID int64 `json:"typeId"`
			}
			decoded, err := url.QueryUnescape(htmlAttr(node, "data-rich-payload"))
			if err == nil && json.Unmarshal([]byte(decoded), &payload) == nil && payload.TypeID == 9 {
				if itemID, ok := mapping[payload.ID]; ok {
					setHTMLAttr(node, "data-rich-node", "item")
					encoded, _ := json.Marshal(struct {
						ID     int64 `json:"id"`
						TypeID int64 `json:"typeId"`
					}{ID: itemID, TypeID: 15})
					setHTMLAttr(node, "data-rich-payload", encodeURIComponent(encoded))
					*nodes++
					changed = true
				}
			}
		}
		changed = rewriteStatusSuggestNodes(node, mapping, nodes) || changed
	}
	return changed
}
