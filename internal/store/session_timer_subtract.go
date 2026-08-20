package store

import "context"

// SubtractSessionTimerTime shortens the remaining countdown without allowing
// it to become negative. Duration stays positive so progress projections never
// divide by zero.
func (s *Store) SubtractSessionTimerTime(ctx context.Context, sessionID, timerID, amountMS int64) (SessionTimer, error) {
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.session_timer
		SET duration_ms = GREATEST(1000, duration_ms - $3),
		    ends_at = CASE
		        WHEN paused THEN NULL
		        ELSE GREATEST(clock_timestamp(), ends_at - ($3::double precision * interval '1 millisecond'))
		    END,
		    remaining_ms = CASE
		        WHEN paused THEN GREATEST(0, COALESCE(remaining_ms, 0) - $3)
		        ELSE NULL
		    END,
		    changed_at = clock_timestamp()
		WHERE session_id = $1 AND id = $2`, sessionID, timerID, amountMS)
	if err != nil {
		return SessionTimer{}, err
	}
	if result.RowsAffected() == 0 {
		return SessionTimer{}, ErrNotFound
	}
	return s.GetSessionTimer(ctx, sessionID, timerID)
}
