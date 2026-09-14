package store

import (
	"encoding/json"
	"math"
)

// Reserve one dose without moving or changing the remaining stack's identity.
func (doc transferDocument) takePotionDose(uid string) (map[string]any, error) {
	entries, _ := doc.values()["potions"].([]any)
	for i, raw := range entries {
		entry, ok := raw.(map[string]any)
		if !ok || entry["uid"] != uid {
			continue
		}
		count := float64(1)
		if entry["count"] != nil {
			count, ok = entry["count"].(float64)
			if !ok || count < 1 || count > 999 || math.Trunc(count) != count {
				return nil, ErrItemTransferConflict
			}
		}
		dose := make(map[string]any, len(entry))
		for key, value := range entry {
			dose[key] = value
		}
		dose["count"] = float64(1)
		if count == 1 {
			doc.values()["potions"] = append(entries[:i:i], entries[i+1:]...)
		} else {
			entry["count"] = count - 1
		}
		return dose, nil
	}
	return nil, ErrItemTransferConflict
}

func potionStackIdentity(entry map[string]any) string {
	identity := make(map[string]any, len(entry))
	for key, value := range entry {
		if key != "count" {
			identity[key] = value
		}
	}
	raw, _ := json.Marshal(identity)
	return string(raw)
}

// Merge only into the unchanged original stack. A moved, edited, spent or
// separately reserved stack gets an independent return entry, never a duplicate UID.
func (doc transferDocument) returnPotionDose(dose map[string]any, uid string) {
	entries, _ := doc.values()["potions"].([]any)
	for _, raw := range entries {
		entry, ok := raw.(map[string]any)
		if !ok || potionStackIdentity(entry) != potionStackIdentity(dose) {
			continue
		}
		count, ok := entry["count"].(float64)
		if ok && count >= 1 && count < 999 && math.Trunc(count) == count {
			entry["count"] = count + 1
			return
		}
	}
	dose["uid"] = uid
	doc.values()["potions"] = append(entries, dose)
}
