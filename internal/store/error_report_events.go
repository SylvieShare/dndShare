package store

import (
	"context"
	"time"
)

type ErrorReportEvent struct {
	ID        int64     `json:"id"`
	ReportID  int64     `json:"reportId"`
	Kind      string    `json:"kind"`
	Approved  bool      `json:"approved"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) ListErrorReportEvents(ctx context.Context, after int64, limit int) ([]ErrorReportEvent, error) {
	if err := s.publishErrorReportEvents(ctx); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT e.delivery_id, e.report_id, e.kind, r.approved, r.status, e.created_at
		FROM dndshare.error_report_event e
		JOIN dndshare.error_report r ON r.id = e.report_id
		WHERE e.delivery_id > $1 ORDER BY e.delivery_id LIMIT $2`, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]ErrorReportEvent, 0)
	for rows.Next() {
		var event ErrorReportEvent
		if err := rows.Scan(&event.ID, &event.ReportID, &event.Kind, &event.Approved, &event.Status, &event.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (s *Store) GetApprovedErrorReport(ctx context.Context, id int64) (ErrorReport, error) {
	if err := s.requeueExpiredErrorReportClaims(ctx); err != nil {
		return ErrorReport{}, err
	}
	reports, err := s.listErrorReports(ctx, 1, 0, false, false, id)
	if err != nil {
		return ErrorReport{}, err
	}
	if len(reports) == 0 || !reports[0].Approved {
		return ErrorReport{}, ErrNotFound
	}
	return reports[0], nil
}

// A business sequence alone is not a safe replay cursor: a lower allocated ID
// may still belong to an uncommitted report. Publish only committed rows and
// serialize delivery-ID allocation until the publication transaction commits.
func (s *Store) publishErrorReportEvents(ctx context.Context) error {
	var pending bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.error_report_event WHERE delivery_id IS NULL)`).Scan(&pending); err != nil {
		return err
	}
	if !pending {
		return nil
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('dndshare.error_report_event_delivery', 0))`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.error_report_event SET delivery_id=nextval('dndshare.error_report_event_delivery_seq')
        WHERE delivery_id IS NULL AND id IN (SELECT id FROM dndshare.error_report_event WHERE delivery_id IS NULL ORDER BY id LIMIT 1000)`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
