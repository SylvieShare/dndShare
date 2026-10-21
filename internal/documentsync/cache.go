// Package documentsync retains a bounded replay/receipt buffer for documents
// whose durable state is stored elsewhere. It never persists map/session history.
package documentsync

import (
	"crypto/sha256"
	"dndshare/internal/documentpatch"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type Mutation struct {
	BaseVersion int64                     `json:"baseVersion"`
	MutationID  string                    `json:"mutationId"`
	Patches     []documentpatch.Operation `json:"patches"`
	Metadata    []json.RawMessage         `json:"metadata,omitempty"`
}

func (m Mutation) Fingerprint() string {
	raw, _ := json.Marshal(m)
	return fmt.Sprintf("%x", sha256.Sum256(raw))
}

type Snapshot struct {
	Data     json.RawMessage `json:"data,omitempty"`
	Version  int64           `json:"version"`
	Metadata json.RawMessage `json:"metadata,omitempty"`
}
type Update struct {
	FromVersion int64                     `json:"fromVersion"`
	Version     int64                     `json:"version"`
	MutationID  string                    `json:"mutationId,omitempty"`
	Patches     []documentpatch.Operation `json:"patches"`
	Data        json.RawMessage           `json:"data,omitempty"`
	Metadata    json.RawMessage           `json:"metadata,omitempty"`
}
type receipt struct {
	hash   string
	update Update
	size   int
}
type entry struct {
	updates     []Update
	updateSizes []int
	receipts    map[string]receipt
	ids         []string
	touched     time.Time
	bytes       int
}
type Cache struct {
	mu      sync.Mutex
	entries map[string]*entry
	bytes   int
}

func New() *Cache { return &Cache{entries: map[string]*entry{}} }
func (c *Cache) drop(key string) {
	if item := c.entries[key]; item != nil {
		c.bytes -= item.bytes
		delete(c.entries, key)
	}
}
func (c *Cache) current(key string) *entry {
	now := time.Now()
	for key, item := range c.entries {
		if now.Sub(item.touched) > 15*time.Minute {
			c.drop(key)
		}
	}
	item := c.entries[key]
	if item == nil {
		if len(c.entries) >= 1024 {
			var oldest string
			var at time.Time
			for key, item := range c.entries {
				if oldest == "" || item.touched.Before(at) {
					oldest, at = key, item.touched
				}
			}
			c.drop(oldest)
		}
		item = &entry{receipts: map[string]receipt{}}
		c.entries[key] = item
	}
	item.touched = now
	return item
}
func (c *Cache) Receipt(key, id, hash string) (Update, bool, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item := c.current(key)
	saved, ok := item.receipts[id]
	return saved.update, ok, ok && saved.hash == hash
}
func (c *Cache) Record(key string, m Mutation, before, after Snapshot) (Update, error) {
	operations, err := documentpatch.Diff(before.Data, after.Data)
	if err != nil {
		return Update{}, err
	}
	update := Update{FromVersion: before.Version, Version: after.Version, MutationID: m.MutationID, Patches: operations, Metadata: after.Metadata}
	encoded, _ := json.Marshal(update)
	size := len(encoded)
	c.mu.Lock()
	defer c.mu.Unlock()
	item := c.current(key)
	if saved, exists := item.receipts[m.MutationID]; exists {
		return saved.update, nil
	}
	item.updates = append(item.updates, update)
	item.updateSizes = append(item.updateSizes, size)
	item.receipts[m.MutationID] = receipt{m.Fingerprint(), update, size}
	item.ids = append(item.ids, m.MutationID)
	item.bytes += 2 * size
	c.bytes += 2 * size
	for len(item.updates) > 128 || item.bytes > 4<<20 && len(item.updates) > 1 {
		item.bytes -= item.updateSizes[0]
		c.bytes -= item.updateSizes[0]
		item.updates = item.updates[1:]
		item.updateSizes = item.updateSizes[1:]
	}
	for len(item.ids) > 256 || item.bytes > 4<<20 && len(item.ids) > 1 {
		receipt := item.receipts[item.ids[0]]
		item.bytes -= receipt.size
		c.bytes -= receipt.size
		delete(item.receipts, item.ids[0])
		item.ids = item.ids[1:]
	}
	for c.bytes > 64<<20 && len(c.entries) > 1 {
		oldest := ""
		var at time.Time
		for candidate, entry := range c.entries {
			if candidate != key && (oldest == "" || entry.touched.Before(at)) {
				oldest, at = candidate, entry.touched
			}
		}
		c.drop(oldest)
	}
	return update, nil
}
func (c *Cache) Since(key string, version int64, current Snapshot) Update {
	result := Update{FromVersion: version, Version: current.Version, Patches: []documentpatch.Operation{}, Metadata: current.Metadata}
	if version == current.Version {
		return result
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	item := c.current(key)
	at := version
	for _, update := range item.updates {
		if update.FromVersion == at && update.Version > at && update.Version <= current.Version {
			result.Patches = append(result.Patches, update.Patches...)
			at = update.Version
		}
	}
	if at != current.Version || len(result.Patches) > 10000 {
		result.Data = current.Data
		result.Patches = []documentpatch.Operation{}
	}
	return result
}
