package store

import (
	"context"
	"crypto/sha256"
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

type ErrorReportClaim struct {
	RunID      string    `json:"runId"`
	ClaimedIDs []int64   `json:"claimedIds"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func errorReportProcessingRunID(leaseID string) string {
	sum := sha256.Sum256([]byte(leaseID))
	return fmt.Sprintf("%x", sum[:8])
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
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ErrorReportAutomationLease{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var lease ErrorReportAutomationLease
	seconds := int64(ttl / time.Second)
	err = tx.QueryRow(ctx, `
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
	if _, err := tx.Exec(ctx, `
		UPDATE dndshare.error_report
		SET processing_expires_at = $2
		WHERE status = 'IN_PROGRESS' AND processing_run_id = $1`,
		errorReportProcessingRunID(leaseID), lease.ExpiresAt); err != nil {
		return ErrorReportAutomationLease{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return ErrorReportAutomationLease{}, false, err
	}
	return lease, true, nil
}

func (s *Store) ReleaseErrorReportAutomationLease(ctx context.Context, leaseID string) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	result, err := tx.Exec(ctx, `
		DELETE FROM dndshare.error_report_automation_lock
		WHERE id = 1 AND token = $1`, leaseID,
	)
	if err != nil {
		return false, err
	}
	if result.RowsAffected() == 0 {
		return false, nil
	}
	if _, err := tx.Exec(ctx, `
		UPDATE dndshare.error_report
		SET status = 'OPEN', processing_run_id = NULL,
		    processing_started_at = NULL, processing_expires_at = NULL
		WHERE status = 'IN_PROGRESS' AND processing_run_id = $1`,
		errorReportProcessingRunID(leaseID)); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) ClaimApprovedErrorReports(ctx context.Context, leaseID string, reportIDs []int64) (ErrorReportClaim, bool, error) {
	uniqueIDs := make([]int64, 0, len(reportIDs))
	seen := make(map[int64]struct{}, len(reportIDs))
	for _, id := range reportIDs {
		if id <= 0 {
			return ErrorReportClaim{}, false, errors.New("error report ids must be positive")
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		uniqueIDs = append(uniqueIDs, id)
	}
	if len(uniqueIDs) == 0 {
		return ErrorReportClaim{}, false, errors.New("at least one error report id is required")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ErrorReportClaim{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var expiresAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT expires_at
		FROM dndshare.error_report_automation_lock
		WHERE id = 1 AND token = $1 AND expires_at > now()
		FOR UPDATE`, leaseID).Scan(&expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrorReportClaim{}, false, nil
	}
	if err != nil {
		return ErrorReportClaim{}, false, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE dndshare.error_report
		SET status = 'OPEN', processing_run_id = NULL,
		    processing_started_at = NULL, processing_expires_at = NULL
		WHERE status = 'IN_PROGRESS'
		  AND (processing_expires_at IS NULL OR processing_expires_at <= now())`); err != nil {
		return ErrorReportClaim{}, false, err
	}

	runID := errorReportProcessingRunID(leaseID)
	rows, err := tx.Query(ctx, `
		UPDATE dndshare.error_report er
		SET status = 'IN_PROGRESS', processing_run_id = $2,
		    processing_started_at = now(), processing_expires_at = $3
		WHERE er.id = ANY($1::bigint[])
		  AND er.approved AND er.status = 'OPEN'
		  AND COALESCE((
		      SELECT m.sender <> 'AI'
		      FROM dndshare.error_report_message m
		      WHERE m.error_report_id = er.id
		      ORDER BY m.id DESC
		      LIMIT 1
		  ), true)
		  AND (er.serious_change_requested_at IS NULL OR er.serious_change_approved_at IS NOT NULL)
		RETURNING er.id`, uniqueIDs, runID, expiresAt)
	if err != nil {
		return ErrorReportClaim{}, false, err
	}
	claimedIDs := make([]int64, 0, len(uniqueIDs))
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return ErrorReportClaim{}, false, err
		}
		claimedIDs = append(claimedIDs, id)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return ErrorReportClaim{}, false, err
	}
	rows.Close()
	if len(claimedIDs) != len(uniqueIDs) {
		return ErrorReportClaim{}, false, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return ErrorReportClaim{}, false, err
	}
	return ErrorReportClaim{RunID: runID, ClaimedIDs: claimedIDs, ExpiresAt: expiresAt}, true, nil
}
