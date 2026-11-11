package store

import (
	"context"
)

func (s *Store) DeleteErrorReport(ctx context.Context, id int64) (bool, error) {
	return s.deleteErrorReport(ctx, id, false)
}

func (s *Store) DeleteApprovedErrorReport(ctx context.Context, id int64) (bool, error) {
	return s.deleteErrorReport(ctx, id, true)
}

func (s *Store) deleteErrorReport(ctx context.Context, id int64, approvedOnly bool) (bool, error) {
	result, err := s.pool.Exec(ctx, `DELETE FROM dndshare.error_report WHERE id = $1 AND (NOT $2::bool OR approved)`, id, approvedOnly)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) SetErrorReportApproved(ctx context.Context, id int64, approved bool) (bool, error) {
	result, err := s.pool.Exec(ctx, `UPDATE dndshare.error_report SET approved = $2 WHERE id = $1`, id, approved)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) SetClaimedErrorReportTitle(ctx context.Context, id int64, title, leaseID string) (bool, error) {
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report er
		SET title = $2
		WHERE er.id = $1
		  AND er.approved
		  AND er.status = 'IN_PROGRESS'
		  AND (er.title IS NULL OR BTRIM(er.title) = '')
		  AND er.processing_run_id = $3
		  AND EXISTS (
		      SELECT 1 FROM dndshare.error_report_automation_lock l
		      WHERE l.id = 1 AND l.token = $4 AND l.expires_at > now()
		  )`, id, title, errorReportProcessingRunID(leaseID), leaseID)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) RequestApprovedErrorReportSeriousChange(ctx context.Context, id int64, reason string, leaseID *string) (bool, error) {
	var processingRunID *string
	if leaseID != nil {
		runID := errorReportProcessingRunID(*leaseID)
		processingRunID = &runID
	}
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report er
		SET serious_change_reason = $2,
		    serious_change_requested_at = now(),
		    serious_change_approved_at = NULL,
		    serious_change_approved_by_user_id = NULL,
		    status = 'OPEN', processing_run_id = NULL,
		    processing_started_at = NULL, processing_expires_at = NULL
		WHERE id = $1
		  AND approved
		  AND ((status = 'OPEN' AND $4::text IS NULL) OR (
		      status = 'IN_PROGRESS' AND processing_run_id = $3
		      AND EXISTS (
		          SELECT 1 FROM dndshare.error_report_automation_lock l
		          WHERE l.id = 1 AND l.token = $4 AND l.expires_at > now()
		      )
		  ))
		  AND COALESCE((
		      SELECT m.sender <> 'AI'
		      FROM dndshare.error_report_message m
		      WHERE m.error_report_id = er.id
		      ORDER BY m.id DESC
		      LIMIT 1
		  ), true)
		  AND NOT (serious_change_requested_at IS NOT NULL AND serious_change_approved_at IS NULL)`,
		id, reason, processingRunID, leaseID)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) ApproveErrorReportSeriousChange(ctx context.Context, id, adminUserID int64) (bool, error) {
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report er
		SET serious_change_approved_at = now(), serious_change_approved_by_user_id = $2
		WHERE id = $1
		  AND status = 'OPEN'
		  AND serious_change_requested_at IS NOT NULL
		  AND serious_change_approved_at IS NULL`, id, adminUserID)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) ResolveApprovedErrorReport(ctx context.Context, id int64, resolution string, commitSHA, leaseID *string) (bool, error) {
	var processingRunID *string
	if leaseID != nil {
		runID := errorReportProcessingRunID(*leaseID)
		processingRunID = &runID
	}
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report er
		SET status = 'RESOLVED', resolution = $2, resolved_commit_sha = $3, resolved_at = now(),
		    processing_run_id = NULL, processing_started_at = NULL, processing_expires_at = NULL
		WHERE id = $1 AND approved
		  AND ((status = 'OPEN' AND $5::text IS NULL) OR (
		      status = 'IN_PROGRESS' AND processing_run_id = $4
		      AND EXISTS (
		          SELECT 1 FROM dndshare.error_report_automation_lock l
		          WHERE l.id = 1 AND l.token = $5 AND l.expires_at > now()
		      )
		  ))
		  AND COALESCE((
		      SELECT m.sender <> 'AI'
		      FROM dndshare.error_report_message m
		      WHERE m.error_report_id = er.id
		      ORDER BY m.id DESC
		      LIMIT 1
		  ), true)
		  AND (serious_change_requested_at IS NULL OR serious_change_approved_at IS NOT NULL)`, id, resolution, commitSHA, processingRunID, leaseID)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) ReopenErrorReport(ctx context.Context, id int64) (bool, error) {
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report
		SET status = 'OPEN', resolution = NULL, resolved_commit_sha = NULL, resolved_at = NULL,
		    processing_run_id = NULL, processing_started_at = NULL, processing_expires_at = NULL,
		    serious_change_reason = NULL, serious_change_requested_at = NULL,
		    serious_change_approved_at = NULL, serious_change_approved_by_user_id = NULL
		WHERE id = $1 AND status IN ('RESOLVED', 'ARCHIVED')`, id)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}

func (s *Store) ArchiveResolvedErrorReport(ctx context.Context, id int64) (bool, error) {
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report
		SET status = 'ARCHIVED'
		WHERE id = $1 AND status = 'RESOLVED'`, id)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}
