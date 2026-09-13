package store

import (
	"encoding/json"
	"errors"
)

var ErrItemTransferConflict = errors.New("предмет или передача уже изменились; обновите лист")
var ErrCharacterVersion = errors.New("лист изменился на сервере; обновите его перед сохранением")

type transferDocument map[string]any

func decodeTransferDocument(raw json.RawMessage) (transferDocument, error) {
	var doc transferDocument
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	if doc == nil {
		return nil, ErrItemTransferConflict
	}
	if _, ok := doc["values"].(map[string]any); !ok {
		doc["values"] = map[string]any{}
	}
	return doc, nil
}

func (doc transferDocument) values() map[string]any { return doc["values"].(map[string]any) }

// The payload is selected from the locked server document, never supplied by a client.
func (doc transferDocument) take(source, uid string) (map[string]any, error) {
	values := doc.values()
	take := func(container map[string]any, key string) map[string]any {
		entries, _ := container[key].([]any)
		for i, raw := range entries {
			entry, ok := raw.(map[string]any)
			if !ok || entry["uid"] != uid {
				continue
			}
			container[key] = append(entries[:i:i], entries[i+1:]...)
			return entry
		}
		return nil
	}
	var entry map[string]any
	switch source {
	case "weapon", "potions":
		entry = take(values, source)
	case "items":
		items, _ := values["items"].(map[string]any)
		if items == nil {
			break
		}
		entry = take(items, "equipped")
		if entry == nil {
			sections, _ := items["sections"].([]any)
			for _, raw := range sections {
				section, _ := raw.(map[string]any)
				if entry = take(section, "items"); entry != nil {
					break
				}
			}
		}
	}
	if entry == nil {
		return nil, ErrItemTransferConflict
	}
	params, _ := entry["params"].(map[string]any)
	magic, _ := params["magic"].(map[string]any)
	if magic["lost"] == true {
		return nil, ErrItemTransferConflict
	}
	return entry, nil
}

// Returns always go into the backpack, so a declined item does not silently
// reactivate equipment effects. Weapons and potions keep their dedicated lists.
func (doc transferDocument) receive(source string, entry map[string]any, accepted bool, uid string) {
	if accepted {
		entry["uid"] = uid
		entry["proficient"] = false
		entry["stat_suggest_id"] = nil
		params, _ := entry["params"].(map[string]any)
		magic, _ := params["magic"].(map[string]any)
		for _, key := range []string{"attuned", "bonus_transfer", "selected_target", "weapon_use"} {
			delete(magic, key)
		}
	}
	values := doc.values()
	if source != "items" {
		entries, _ := values[source].([]any)
		values[source] = append(entries, entry)
		return
	}
	items, _ := values["items"].(map[string]any)
	if items == nil {
		items = map[string]any{"equipped": []any{}}
		values["items"] = items
	}
	sections, _ := items["sections"].([]any)
	if len(sections) == 0 {
		sections = []any{map[string]any{"id": "received-items", "name": "Рюкзак", "items": []any{}}}
		items["sections"] = sections
	}
	section, ok := sections[0].(map[string]any)
	if !ok {
		section = map[string]any{"id": "received-items", "name": "Рюкзак"}
		sections[0] = section
	}
	entries, _ := section["items"].([]any)
	section["items"] = append(entries, entry)
}
