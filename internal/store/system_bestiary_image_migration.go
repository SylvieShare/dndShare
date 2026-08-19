package store

import (
	"context"
	"fmt"
)

const auditSystemBestiaryIconMigrationSQL = `
	SELECT
		COUNT(*) FILTER (WHERE icon_image_id IS NOT NULL),
		COUNT(*) FILTER (
			WHERE icon_image_id IS NOT NULL
			  AND id = ANY($1::bigint[])
		),
		COUNT(*) FILTER (
			WHERE icon_image_id IS NOT NULL
			  AND NOT (id = ANY($1::bigint[]))
			  AND cover_image_id IS NOT NULL
		),
		COUNT(*) FILTER (
			WHERE icon_image_id IS NOT NULL
			  AND NOT (id = ANY($1::bigint[]))
			  AND cover_image_id IS NULL
		)
	FROM dndshare.item
	WHERE user_id IS NULL
	  AND type_id = 6`

const applySystemBestiaryIconMigrationSQL = `
	WITH moved AS (
		UPDATE dndshare.item
		SET cover_image_id = icon_image_id,
		    icon_image_id = NULL
		WHERE user_id IS NULL
		  AND type_id = 6
		  AND icon_image_id IS NOT NULL
		  AND cover_image_id IS NULL
		  AND NOT (id = ANY($1::bigint[]))
		RETURNING cover_image_id
	), retagged AS (
		UPDATE dndshare.storage_image image
		SET "type" = 'item_cover'
		WHERE image.id IN (SELECT cover_image_id FROM moved)
		RETURNING image.id
	)
	SELECT COUNT(*) FROM moved`

// SystemBestiaryIconMigration describes a dry-run or completed migration of
// legacy bestiary raster icons into the cover slot.
type SystemBestiaryIconMigration struct {
	SourceCount         int64 `json:"sourceCount"`
	ExcludedCount       int64 `json:"excludedCount"`
	TargetOccupiedCount int64 `json:"targetOccupiedCount"`
	CandidateCount      int64 `json:"candidateCount"`
	MovedCount          int64 `json:"movedCount"`
	Applied             bool  `json:"applied"`
}

// MigrateSystemBestiaryIconsToCovers moves legacy raster artwork without
// changing S3 objects. It only touches base bestiary items, skips explicitly
// excluded rows and never overwrites an existing cover.
func (s *Store) MigrateSystemBestiaryIconsToCovers(ctx context.Context, excludeItemIDs []int64, apply bool, expectedCandidateCount *int64) (SystemBestiaryIconMigration, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SystemBestiaryIconMigration{}, err
	}
	defer tx.Rollback(ctx)

	result := SystemBestiaryIconMigration{Applied: apply}
	if err := tx.QueryRow(ctx, auditSystemBestiaryIconMigrationSQL, excludeItemIDs).Scan(
		&result.SourceCount,
		&result.ExcludedCount,
		&result.TargetOccupiedCount,
		&result.CandidateCount,
	); err != nil {
		return SystemBestiaryIconMigration{}, err
	}

	if !apply {
		return result, nil
	}
	if expectedCandidateCount == nil {
		return SystemBestiaryIconMigration{}, fmt.Errorf("expected candidate count is required when applying the migration")
	}
	if *expectedCandidateCount != result.CandidateCount {
		return SystemBestiaryIconMigration{}, fmt.Errorf(
			"candidate count changed: expected %d, found %d; run a new dry-run",
			*expectedCandidateCount,
			result.CandidateCount,
		)
	}

	if err := tx.QueryRow(ctx, applySystemBestiaryIconMigrationSQL, excludeItemIDs).Scan(&result.MovedCount); err != nil {
		return SystemBestiaryIconMigration{}, err
	}
	if result.MovedCount != result.CandidateCount {
		return SystemBestiaryIconMigration{}, fmt.Errorf(
			"migration moved %d rows after auditing %d candidates",
			result.MovedCount,
			result.CandidateCount,
		)
	}
	if err := tx.Commit(ctx); err != nil {
		return SystemBestiaryIconMigration{}, err
	}
	return result, nil
}
