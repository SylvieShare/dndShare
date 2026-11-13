package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type ErrorReportPhaseDuration struct {
	Phase      string `json:"phase"`
	DurationMs int64  `json:"durationMs"`
}

// Durations are elapsed wall time between explicit phase transitions, not CPU time.
type ErrorReportTiming struct {
	Phases              []ErrorReportPhaseDuration `json:"phases"`
	TotalMs             int64                      `json:"totalMs"`
	BeforeWorkMs        int64                      `json:"beforeWorkMs"`
	FirstStartedAt      time.Time                  `json:"firstStartedAt"`
	SnapshotAt          time.Time                  `json:"snapshotAt"`
	ActivePhase         *string                    `json:"activePhase"`
	ActiveUntil         *time.Time                 `json:"activeUntil"`
	IntervalCount       int                        `json:"intervalCount"`
	IncludesBuildInTest bool                       `json:"includesBuildInTest"`
}

func ValidErrorReportPhase(phase string) bool {
	switch phase {
	case "analysis", "fix", "test", "build", "deploy", "pause":
		return true
	}
	return false
}

// SetClaimedErrorReportPhase serializes transitions with lifecycle operations.
// Retrying the current phase is a no-op, preserving its original start time.
func (s *Store) SetClaimedErrorReportPhase(ctx context.Context, id int64, phase, leaseID string) (bool, error) {
	if !ValidErrorReportPhase(phase) {
		return false, errors.New("invalid error report phase")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var reportID int64
	err = tx.QueryRow(ctx, `
        SELECT er.id FROM dndshare.error_report er
        WHERE er.id=$1 AND er.approved AND er.status='IN_PROGRESS'
          AND er.processing_run_id=$2 AND er.processing_expires_at > clock_timestamp()
          AND EXISTS (SELECT 1 FROM dndshare.error_report_automation_lock l
              WHERE l.id=1 AND l.token=$3 AND l.expires_at > clock_timestamp())
        FOR UPDATE OF er`, id, errorReportProcessingRunID(leaseID), leaseID).Scan(&reportID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var current string
	err = tx.QueryRow(ctx, `SELECT phase FROM dndshare.error_report_work_interval
        WHERE error_report_id=$1 AND ended_at IS NULL`, id).Scan(&current)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}
	if current != phase {
		var boundary time.Time
		if err := tx.QueryRow(ctx, `SELECT clock_timestamp()`).Scan(&boundary); err != nil {
			return false, err
		}
		if _, err := tx.Exec(ctx, `UPDATE dndshare.error_report_work_interval SET ended_at=$2
            WHERE error_report_id=$1 AND ended_at IS NULL`, id, boundary); err != nil {
			return false, err
		}
		if phase != "pause" {
			if _, err := tx.Exec(ctx, `INSERT INTO dndshare.error_report_work_interval(error_report_id,phase,started_at,separate_build)
                VALUES($1,$2,$3,true)`, id, phase, boundary); err != nil {
				return false, err
			}
		}
	}
	return true, tx.Commit(ctx)
}

func (s *Store) attachErrorReportTimings(ctx context.Context, reports []ErrorReport, ids []int64) error {
	rows, err := s.pool.Query(ctx, `
        SELECT w.error_report_id,w.phase,w.started_at,w.ended_at,er.processing_expires_at,statement_timestamp(),w.separate_build
        FROM dndshare.error_report_work_interval w
        JOIN dndshare.error_report er ON er.id=w.error_report_id
        WHERE w.error_report_id=ANY($1::bigint[]) ORDER BY w.error_report_id,w.id`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	index := make(map[int64]int, len(reports))
	for i := range reports {
		index[reports[i].ID] = i
	}
	for rows.Next() {
		var id int64
		var phase string
		var start, snapshot time.Time
		var end, expires *time.Time
		var separateBuild bool
		if err := rows.Scan(&id, &phase, &start, &end, &expires, &snapshot, &separateBuild); err != nil {
			return err
		}
		report := &reports[index[id]]
		if report.Timing == nil {
			report.Timing = &ErrorReportTiming{FirstStartedAt: start, SnapshotAt: snapshot,
				BeforeWorkMs: max(0, start.Sub(report.CreatedAt).Milliseconds()),
				Phases:       []ErrorReportPhaseDuration{{Phase: "analysis"}, {Phase: "fix"}, {Phase: "test"}, {Phase: "build"}, {Phase: "deploy"}}}
		}
		timing := report.Timing
		if phase == "test" && !separateBuild {
			timing.IncludesBuildInTest = true
		}
		finish := snapshot
		if end != nil {
			finish = *end
		} else if expires != nil {
			if expires.Before(finish) {
				finish = *expires
			}
			if expires.After(snapshot) {
				timing.ActivePhase = &phase
				timing.ActiveUntil = expires
			}
		} else {
			finish = start
		}
		duration := max(0, finish.Sub(start).Milliseconds())
		timing.TotalMs += duration
		timing.IntervalCount++
		for i := range timing.Phases {
			if timing.Phases[i].Phase == phase {
				timing.Phases[i].DurationMs += duration
			}
		}
	}
	return rows.Err()
}
