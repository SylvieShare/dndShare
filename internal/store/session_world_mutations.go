package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func sameWorldParent(left, right *int64) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func validateLocationParentTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID, locationID int64,
	parentID *int64,
) error {
	if parentID == nil {
		return nil
	}
	var parentSessionID int64
	if err := tx.QueryRow(ctx,
		`SELECT session_id FROM dndshare.session_location WHERE id = $1`, *parentID,
	).Scan(&parentSessionID); err != nil || parentSessionID != sessionID {
		return ErrInvalidWorldReference
	}
	if locationID == 0 {
		return nil
	}
	if *parentID == locationID {
		return ErrInvalidWorldReference
	}
	var createsCycle bool
	err := tx.QueryRow(ctx, `
		WITH RECURSIVE descendants AS (
			SELECT id FROM dndshare.session_location WHERE parent_location_id = $1
			UNION ALL
			SELECT child.id
			FROM dndshare.session_location child
			JOIN descendants parent ON child.parent_location_id = parent.id
		)
		SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2)`, locationID, *parentID,
	).Scan(&createsCycle)
	if err != nil {
		return err
	}
	if createsCycle {
		return ErrInvalidWorldReference
	}
	return nil
}

func validateNPCRaceItemTx(ctx context.Context, tx pgx.Tx, sessionID int64, raceItemID *int64) error {
	if raceItemID == nil {
		return nil
	}
	var valid bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM dndshare.item race
			JOIN dndshare."session" session ON session.id = $1
			WHERE race.id = $2 AND race.type_id = 8
			  AND (race.user_id IS NULL OR race.user_id = session.owner_user_id)
		)`, sessionID, *raceItemID,
	).Scan(&valid)
	if err != nil {
		return err
	}
	if !valid {
		return ErrInvalidWorldReference
	}
	return nil
}

func (s *Store) CreateSessionLocation(
	ctx context.Context,
	sessionID int64,
	mutation SessionLocationMutation,
) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if err := validateLocationParentTx(ctx, tx, sessionID, 0, mutation.ParentLocationID); err != nil {
		return 0, err
	}
	if err := validateSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityLocation, 0, mutation.Relations); err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.session_location (
			session_id, parent_location_id, name, kind, description, image_id, sort_order
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			(SELECT COALESCE(MAX(sort_order), -1) + 1
			 FROM dndshare.session_location
			 WHERE session_id = $1 AND parent_location_id IS NOT DISTINCT FROM $2)
		) RETURNING id`,
		sessionID, mutation.ParentLocationID, mutation.Name, mutation.Kind,
		mutation.Description, mutation.ImageID,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityLocation, id, mutation.Relations); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) UpdateSessionLocation(
	ctx context.Context,
	sessionID, locationID int64,
	mutation SessionLocationMutation,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var currentParent *int64
	err = tx.QueryRow(ctx, `
		SELECT parent_location_id FROM dndshare.session_location
		WHERE id = $1 AND session_id = $2 FOR UPDATE`, locationID, sessionID,
	).Scan(&currentParent)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if err := validateLocationParentTx(ctx, tx, sessionID, locationID, mutation.ParentLocationID); err != nil {
		return err
	}
	if err := validateSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityLocation, locationID, mutation.Relations); err != nil {
		return err
	}
	if !sameWorldParent(currentParent, mutation.ParentLocationID) {
		if err := moveSessionLocationTx(ctx, tx, sessionID, locationID, mutation.ParentLocationID, nil); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE dndshare.session_location
		SET name = $3, kind = $4, description = $5, image_id = $6, changed_at = now()
		WHERE id = $1 AND session_id = $2`,
		locationID, sessionID, mutation.Name, mutation.Kind, mutation.Description, mutation.ImageID,
	); err != nil {
		return err
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityLocation, locationID, mutation.Relations); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func moveSessionLocationTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID, locationID int64,
	parentID, beforeID *int64,
) error {
	var existingSessionID int64
	if err := tx.QueryRow(ctx,
		`SELECT session_id FROM dndshare.session_location WHERE id = $1 FOR UPDATE`, locationID,
	).Scan(&existingSessionID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if existingSessionID != sessionID {
		return ErrInvalidWorldReference
	}
	if err := validateLocationParentTx(ctx, tx, sessionID, locationID, parentID); err != nil {
		return err
	}

	rows, err := tx.Query(ctx, `
		SELECT id FROM dndshare.session_location
		WHERE session_id = $1 AND parent_location_id IS NOT DISTINCT FROM $2 AND id <> $3
		ORDER BY sort_order, id FOR UPDATE`, sessionID, parentID, locationID)
	if err != nil {
		return err
	}
	siblings := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		siblings = append(siblings, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	insertAt := len(siblings)
	if beforeID != nil {
		insertAt = -1
		for index, id := range siblings {
			if id == *beforeID {
				insertAt = index
				break
			}
		}
		if insertAt < 0 {
			return ErrInvalidWorldReference
		}
	}
	ordered := append(siblings, 0)
	copy(ordered[insertAt+1:], ordered[insertAt:])
	ordered[insertAt] = locationID
	if _, err := tx.Exec(ctx, `
		UPDATE dndshare.session_location
		SET parent_location_id = $2, changed_at = now()
		WHERE id = $1`, locationID, parentID,
	); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		UPDATE dndshare.session_location location
		SET sort_order = ordered.position::int - 1
		FROM unnest($1::bigint[]) WITH ORDINALITY AS ordered(id, position)
		WHERE location.id = ordered.id`, ordered)
	return err
}

func (s *Store) MoveSessionLocation(
	ctx context.Context,
	sessionID, locationID int64,
	parentID, beforeID *int64,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := moveSessionLocationTx(ctx, tx, sessionID, locationID, parentID, beforeID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteSessionLocation(ctx context.Context, sessionID, locationID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var childCount int
	if err := tx.QueryRow(ctx, `
		SELECT count(*) FROM dndshare.session_location
		WHERE session_id = $1 AND parent_location_id = $2`, sessionID, locationID,
	).Scan(&childCount); err != nil {
		return err
	}
	if childCount > 0 {
		return ErrLocationHasChildren
	}
	if err := ensureSessionEntityNotUsedBySceneTx(ctx, tx, sessionID, SessionEntityLocation, locationID); err != nil {
		return err
	}
	if err := deleteSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityLocation, locationID); err != nil {
		return err
	}
	result, err := tx.Exec(ctx,
		`DELETE FROM dndshare.session_location WHERE id = $1 AND session_id = $2`, locationID, sessionID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

func (s *Store) CreateSessionNPC(
	ctx context.Context,
	sessionID int64,
	mutation SessionNPCMutation,
) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if err := validateSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityNPC, 0, mutation.Relations); err != nil {
		return 0, err
	}
	if err := validateNPCRaceItemTx(ctx, tx, sessionID, mutation.RaceItemID); err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.session_npc (
			session_id, name, race_item_id, role, description, color,
			image_id, image_focal_x, image_focal_y, sort_order
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
			(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM dndshare.session_npc WHERE session_id = $1))
		RETURNING id`, sessionID, mutation.Name, mutation.RaceItemID, mutation.Role, mutation.Description, mutation.Color,
		mutation.ImageID, mutation.ImageFocalX, mutation.ImageFocalY,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityNPC, id, mutation.Relations); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) UpdateSessionNPC(
	ctx context.Context,
	sessionID, npcID int64,
	mutation SessionNPCMutation,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := validateSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityNPC, npcID, mutation.Relations); err != nil {
		return err
	}
	if err := validateNPCRaceItemTx(ctx, tx, sessionID, mutation.RaceItemID); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `
		UPDATE dndshare.session_npc
		SET name = $3, race_item_id = $4, role = $5, description = $6, color = $7,
		    image_id = $8, image_focal_x = $9, image_focal_y = $10,
		    changed_at = now()
		WHERE id = $1 AND session_id = $2`,
		npcID, sessionID, mutation.Name, mutation.RaceItemID, mutation.Role, mutation.Description, mutation.Color,
		mutation.ImageID, mutation.ImageFocalX, mutation.ImageFocalY)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err := replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityNPC, npcID, mutation.Relations); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteSessionNPC(ctx context.Context, sessionID, npcID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := ensureSessionEntityNotUsedBySceneTx(ctx, tx, sessionID, SessionEntityNPC, npcID); err != nil {
		return err
	}
	if err := deleteSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityNPC, npcID); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `DELETE FROM dndshare.session_npc WHERE id = $1 AND session_id = $2`, npcID, sessionID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}
