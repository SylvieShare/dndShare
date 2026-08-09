package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type ErrorReportAutomationLease struct {
	LeaseID    string    `json:"leaseId"`
	AcquiredAt time.Time `json:"acquiredAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func (s *Store) AcquireErrorReportAutomationLease(ctx context.Context, leaseID string, ttl time.Duration) (ErrorReportAutomationLease, bool, error) {
	seconds := int64(ttl / time.Second)
	for attempt := 0; attempt < 2; attempt++ {
		var lease ErrorReportAutomationLease
		err := s.pool.QueryRow(ctx, `
			INSERT INTO dndshare.error_report_automation_lock (id, token, acquired_at, expires_at)
			VALUES (1, $1, now(), now() + ($2::double precision * interval '1 second'))
			ON CONFLICT (id) DO UPDATE
			SET token = EXCLUDED.token,
			    acquired_at = EXCLUDED.acquired_at,
			    expires_at = EXCLUDED.expires_at
			WHERE dndshare.error_report_automation_lock.expires_at <= now()
			RETURNING token, acquired_at, expires_at`, leaseID, seconds,
		).Scan(&lease.LeaseID, &lease.AcquiredAt, &lease.ExpiresAt)
		if err == nil {
			return lease, true, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return ErrorReportAutomationLease{}, false, err
		}

		err = s.pool.QueryRow(ctx, `
			SELECT token, acquired_at, expires_at
			FROM dndshare.error_report_automation_lock
			WHERE id = 1`,
		).Scan(&lease.LeaseID, &lease.AcquiredAt, &lease.ExpiresAt)
		if err == nil {
			return lease, false, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return ErrorReportAutomationLease{}, false, err
		}
	}
	return ErrorReportAutomationLease{}, false, fmt.Errorf("automation lease changed concurrently")
}

func (s *Store) RenewErrorReportAutomationLease(ctx context.Context, leaseID string, ttl time.Duration) (ErrorReportAutomationLease, bool, error) {
	var lease ErrorReportAutomationLease
	seconds := int64(ttl / time.Second)
	err := s.pool.QueryRow(ctx, `
		UPDATE dndshare.error_report_automation_lock
		SET expires_at = now() + ($2::double precision * interval '1 second')
		WHERE id = 1 AND token = $1 AND expires_at > now()
		RETURNING token, acquired_at, expires_at`, leaseID, seconds,
	).Scan(&lease.LeaseID, &lease.AcquiredAt, &lease.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrorReportAutomationLease{}, false, nil
	}
	if err != nil {
		return ErrorReportAutomationLease{}, false, err
	}
	return lease, true, nil
}

func (s *Store) ReleaseErrorReportAutomationLease(ctx context.Context, leaseID string) (bool, error) {
	result, err := s.pool.Exec(ctx, `
		DELETE FROM dndshare.error_report_automation_lock
		WHERE id = 1 AND token = $1`, leaseID,
	)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}
