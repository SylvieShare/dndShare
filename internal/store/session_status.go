package store

import "context"

func (s *Store) UpdateSessionStatus(ctx context.Context, sessionID int64, status string) error {
	_, err := s.pool.Exec(ctx, `UPDATE dndshare."session" SET status = $2, changed_at = now()
		WHERE id = $1 AND deleted = false`, sessionID, status)
	return err
}
