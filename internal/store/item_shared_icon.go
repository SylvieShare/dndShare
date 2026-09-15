package store

import (
	"context"
)

// Reuse the same media row for two system entries; never copy the asset or
// establish a runtime inheritance relationship. Existing media stays available.
func (s *Store) ReuseSystemItemIcon(ctx context.Context, itemID, sourceID int64) error {
	result, err := s.pool.Exec(ctx, `UPDATE dndshare.item target
 SET icon_image_id=source.icon_image_id, icon_svg_id=source.icon_svg_id
 FROM dndshare.item source
 WHERE target.id=$1 AND source.id=$2 AND target.user_id IS NULL AND source.user_id IS NULL
 AND (source.icon_image_id IS NOT NULL OR source.icon_svg_id IS NOT NULL)`, itemID, sourceID)
	if err == nil && result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}
