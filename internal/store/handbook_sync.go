package store

import (
	"context"
	"time"
)

// HandbookSyncPosition keeps a fixed maximum ID and starting revision.
// Pages may include newer values: the next round replays them safely.
type HandbookSyncPosition struct {
	BaseRevision int64
	Revision     int64
	LastID       int64
	MaxID        int64
}

type HandbookSyncEntry struct {
	ID        int64     `json:"id"`
	Revision  int64     `json:"revision"`
	ChangedAt time.Time `json:"changedAt"`
	Deleted   bool      `json:"deleted"`
	Item      *Item     `json:"item,omitempty"`
}

type HandbookSyncMetadata struct {
	Types        []ItemType          `json:"types"`
	SuggestTypes []SuggestType       `json:"suggestTypes"`
	Suggests     map[int64][]Suggest `json:"suggests"`
	Books        []ContentSource     `json:"books"`
}

type HandbookSyncPage struct {
	Entries    []HandbookSyncEntry   `json:"entries"`
	Metadata   *HandbookSyncMetadata `json:"metadata,omitempty"`
	VisibleIDs []int64               `json:"visibleIds,omitempty"`
	HasMore    bool                  `json:"hasMore"`
	Position   HandbookSyncPosition  `json:"-"`
}

func (s *Store) HandbookSyncStart(ctx context.Context, userID, sourceID, baseRevision int64) (HandbookSyncPosition, error) {
	var result HandbookSyncPosition
	var exists bool
	// One statement sees a consistent committed watermark and ID bound.
	err := s.pool.QueryRow(ctx, `SELECT
 EXISTS(SELECT 1 FROM dndshare.source WHERE id=$1),
 COALESCE((SELECT revision FROM dndshare.handbook_sync_clock WHERE singleton),0),
 COALESCE((SELECT max(i.id) FROM dndshare.item i JOIN dndshare.item_type t ON t.id=i.type_id
   WHERE t.source_id=$1 AND (i.user_id IS NULL OR i.user_id=$2)),0)`, sourceID, userID).
		Scan(&exists, &result.Revision, &result.MaxID)
	if err != nil {
		return result, err
	}
	if !exists {
		return result, ErrNotFound
	}
	result.BaseRevision = baseRevision
	return result, nil
}

func (s *Store) HandbookSync(ctx context.Context, userID, sourceID int64, position HandbookSyncPosition, limit int) (HandbookSyncPage, error) {
	result := HandbookSyncPage{Entries: []HandbookSyncEntry{}, Position: position}
	rows, err := s.pool.Query(ctx, `SELECT i.id,i.sync_revision,i.changed_at,i.deleted
 FROM dndshare.item i JOIN dndshare.item_type t ON t.id=i.type_id
 WHERE t.source_id=$1 AND (i.user_id IS NULL OR i.user_id=$2)
   AND i.id>$3 AND i.id<=$4 AND i.sync_revision>$5
 ORDER BY i.id LIMIT $6`,
		sourceID, userID, position.LastID, position.MaxID, position.BaseRevision, limit+1)
	if err != nil {
		return result, err
	}
	for rows.Next() {
		var entry HandbookSyncEntry
		if err = rows.Scan(&entry.ID, &entry.Revision, &entry.ChangedAt, &entry.Deleted); err != nil {
			rows.Close()
			return result, err
		}
		result.Entries = append(result.Entries, entry)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	result.HasMore = len(result.Entries) > limit
	if result.HasMore {
		result.Entries = result.Entries[:limit]
	}
	ids := []int64{}
	for _, entry := range result.Entries {
		if !entry.Deleted {
			ids = append(ids, entry.ID)
		}
	}
	// Reuse the normal projection, including private-reference filtering.
	items, err := s.GetByIds(ctx, ids, &userID)
	if err != nil {
		return result, err
	}
	byID := map[int64]*Item{}
	for index := range items {
		byID[items[index].ID] = &items[index]
	}
	for index := range result.Entries {
		entry := &result.Entries[index]
		entry.Item = byID[entry.ID]
		if entry.Item == nil {
			entry.Deleted = true
		} else {
			// Bootstrap transfers descriptions and media IDs, never image bytes.
			entry.Item.SVG = nil
		}
		result.Position.LastID = entry.ID
	}
	if position.LastID == 0 {
		metadata, err := s.handbookSyncMetadata(ctx, sourceID, userID)
		if err != nil {
			return result, err
		}
		result.Metadata = &metadata
	}
	if !result.HasMore {
		// Reconcile records that moved to another owner/system as well.
		result.VisibleIDs, err = s.handbookVisibleIDs(ctx, sourceID, userID)
	}
	return result, err
}

func (s *Store) handbookSyncMetadata(ctx context.Context, sourceID, userID int64) (HandbookSyncMetadata, error) {
	var result HandbookSyncMetadata
	var err error
	result.Types, err = s.ItemTypeGetAll(ctx, &sourceID)
	if err != nil {
		return result, err
	}
	result.SuggestTypes, err = s.GetAllSuggestTypes(ctx, &sourceID)
	if err != nil {
		return result, err
	}
	ids := []int64{}
	for _, item := range result.SuggestTypes {
		ids = append(ids, item.ID)
	}
	result.Suggests, err = s.GetSuggestsByTypes(ctx, ids, &userID)
	if err != nil {
		return result, err
	}
	for key, values := range result.Suggests {
		for index := range values {
			values[index].Svg = nil
		}
		result.Suggests[key] = values
	}
	for index := range result.SuggestTypes {
		result.SuggestTypes[index].Svg = nil
	}
	result.Books, err = s.GetContentSources(ctx, &sourceID, nil)
	return result, err
}

func (s *Store) handbookVisibleIDs(ctx context.Context, sourceID, userID int64) ([]int64, error) {
	rows, err := s.pool.Query(ctx, `SELECT i.id FROM dndshare.active_item i
 JOIN dndshare.item_type t ON t.id=i.type_id
 WHERE t.source_id=$1 AND (i.user_id IS NULL OR i.user_id=$2) ORDER BY i.id`, sourceID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
