package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// SessionTimer is a persistent master-only timer. Running timers keep an
// absolute deadline; paused timers keep a frozen remaining duration instead.
// This makes the countdown independent from browser refreshes and sleep.
type SessionTimer struct {
	ID          int64
	SessionID   int64
	Description string
	DurationMS  int64
	EndsAt      *time.Time
	RemainingMS *int64
	Paused      bool
	Broadcast   bool
	CreatedAt   time.Time
	ChangedAt   time.Time
}

const sessionTimerSelect = `
	SELECT id, session_id, description, duration_ms, ends_at, remaining_ms,
	       paused, broadcast, created_at, changed_at
	FROM dndshare.session_timer`

func scanSessionTimer(row pgx.Row) (SessionTimer, error) {
	var timer SessionTimer
	err := row.Scan(
		&timer.ID, &timer.SessionID, &timer.Description, &timer.DurationMS,
		&timer.EndsAt, &timer.RemainingMS, &timer.Paused, &timer.Broadcast,
		&timer.CreatedAt, &timer.ChangedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionTimer{}, ErrNotFound
	}
	return timer, err
}

func (s *Store) ListSessionTimers(ctx context.Context, sessionID int64) ([]SessionTimer, error) {
	rows, err := s.pool.Query(ctx, sessionTimerSelect+`
		WHERE session_id = $1
		ORDER BY created_at, id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	timers := []SessionTimer{}
	for rows.Next() {
		timer, err := scanSessionTimer(rows)
		if err != nil {
			return nil, err
		}
		timers = append(timers, timer)
	}
	return timers, rows.Err()
}

func (s *Store) ListBroadcastSessionTimers(ctx context.Context, sessionID int64) ([]SessionTimer, error) {
	rows, err := s.pool.Query(ctx, sessionTimerSelect+`
		WHERE session_id = $1 AND broadcast = true
		ORDER BY created_at, id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	timers := []SessionTimer{}
	for rows.Next() {
		timer, err := scanSessionTimer(rows)
		if err != nil {
			return nil, err
		}
		timers = append(timers, timer)
	}
	return timers, rows.Err()
}

func (s *Store) GetSessionTimer(ctx context.Context, sessionID, timerID int64) (SessionTimer, error) {
	return scanSessionTimer(s.pool.QueryRow(ctx, sessionTimerSelect+`
		WHERE session_id = $1 AND id = $2`, sessionID, timerID))
}

func (s *Store) CreateSessionTimer(ctx context.Context, sessionID int64, description string, durationMS int64, broadcast bool) (SessionTimer, error) {
	return scanSessionTimer(s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.session_timer
		    (session_id, description, duration_ms, ends_at, broadcast)
		VALUES ($1, $2, $3, clock_timestamp() + ($3::double precision * interval '1 millisecond'), $4)
		RETURNING id, session_id, description, duration_ms, ends_at, remaining_ms,
		          paused, broadcast, created_at, changed_at`, sessionID, description, durationMS, broadcast))
}

func (s *Store) PauseSessionTimer(ctx context.Context, sessionID, timerID int64) (SessionTimer, error) {
	return scanSessionTimer(s.pool.QueryRow(ctx, `
		UPDATE dndshare.session_timer
		SET paused = true,
		    remaining_ms = (GREATEST(0, EXTRACT(EPOCH FROM (ends_at - clock_timestamp())) * 1000))::bigint,
		    ends_at = NULL,
		    changed_at = clock_timestamp()
		WHERE session_id = $1 AND id = $2 AND paused = false
		RETURNING id, session_id, description, duration_ms, ends_at, remaining_ms,
		          paused, broadcast, created_at, changed_at`, sessionID, timerID))
}

func (s *Store) ResumeSessionTimer(ctx context.Context, sessionID, timerID int64) (SessionTimer, error) {
	return scanSessionTimer(s.pool.QueryRow(ctx, `
		UPDATE dndshare.session_timer
		SET paused = false,
		    ends_at = clock_timestamp() + (remaining_ms::double precision * interval '1 millisecond'),
		    remaining_ms = NULL,
		    changed_at = clock_timestamp()
		WHERE session_id = $1 AND id = $2 AND paused = true AND remaining_ms > 0
		RETURNING id, session_id, description, duration_ms, ends_at, remaining_ms,
		          paused, broadcast, created_at, changed_at`, sessionID, timerID))
}

func (s *Store) AddSessionTimerTime(ctx context.Context, sessionID, timerID, amountMS int64) (SessionTimer, error) {
	return scanSessionTimer(s.pool.QueryRow(ctx, `
		UPDATE dndshare.session_timer
		SET duration_ms = duration_ms + $3,
		    ends_at = CASE
		        WHEN paused THEN NULL
		        ELSE GREATEST(ends_at, clock_timestamp()) + ($3::double precision * interval '1 millisecond')
		    END,
		    remaining_ms = CASE WHEN paused THEN remaining_ms + $3 ELSE NULL END,
		    changed_at = clock_timestamp()
		WHERE session_id = $1 AND id = $2
		RETURNING id, session_id, description, duration_ms, ends_at, remaining_ms,
		          paused, broadcast, created_at, changed_at`, sessionID, timerID, amountMS))
}

func (s *Store) DeleteSessionTimer(ctx context.Context, sessionID, timerID int64) error {
	result, err := s.pool.Exec(ctx, `DELETE FROM dndshare.session_timer WHERE session_id = $1 AND id = $2`, sessionID, timerID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
