package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ErrorReport is a user-submitted pointer to a broken element on a page.
// Element stays as JSON so the browser can include selector and accessibility
// metadata without requiring a schema migration for every new diagnostic field.
type ErrorReport struct {
	ID                            int64                `json:"id"`
	Title                         *string              `json:"title"`
	Description                   string               `json:"description"`
	PageURL                       string               `json:"pageUrl"`
	Element                       json.RawMessage      `json:"element"`
	UserID                        *int64               `json:"userId"`
	UserLogin                     *string              `json:"userLogin"`
	Approved                      bool                 `json:"approved"`
	Status                        string               `json:"status"`
	ProcessingRunID               *string              `json:"processingRunId,omitempty"`
	ProcessingStartedAt           *time.Time           `json:"processingStartedAt,omitempty"`
	ProcessingExpiresAt           *time.Time           `json:"processingExpiresAt,omitempty"`
	Resolution                    *string              `json:"resolution"`
	ResolvedCommitSHA             *string              `json:"resolvedCommitSha"`
	ResolvedAt                    *time.Time           `json:"resolvedAt"`
	HasScreenshot                 bool                 `json:"hasScreenshot"`
	ScreenshotContentType         *string              `json:"screenshotContentType,omitempty"`
	HasViewportScreenshot         bool                 `json:"hasViewportScreenshot"`
	ViewportScreenshotContentType *string              `json:"viewportScreenshotContentType,omitempty"`
	Messages                      []ErrorReportMessage `json:"messages"`
	WaitingForAnswer              bool                 `json:"waitingForAnswer"`
	SeriousChangeReason           *string              `json:"seriousChangeReason,omitempty"`
	SeriousChangeRequestedAt      *time.Time           `json:"seriousChangeRequestedAt,omitempty"`
	SeriousChangeApprovedAt       *time.Time           `json:"seriousChangeApprovedAt,omitempty"`
	SeriousChangeApprovedByUserID *int64               `json:"seriousChangeApprovedByUserId,omitempty"`
	SeriousChangeApprovedByLogin  *string              `json:"seriousChangeApprovedByLogin,omitempty"`
	WaitingForSeriousApproval     bool                 `json:"waitingForSeriousApproval"`
	CreatedAt                     time.Time            `json:"createdAt"`
}

const (
	ErrorReportStatusOpen       = "OPEN"
	ErrorReportStatusInProgress = "IN_PROGRESS"
	ErrorReportStatusResolved   = "RESOLVED"
	ErrorReportStatusArchived   = "ARCHIVED"

	ErrorReportMessageSenderAI    = "AI"
	ErrorReportMessageSenderAdmin = "ADMIN"
)

var (
	ErrErrorReportAwaitingAnswer    = errors.New("error report is awaiting an admin answer")
	ErrErrorReportNotAwaitingAnswer = errors.New("error report is not awaiting an admin answer")
)

type ErrorReportMessage struct {
	ID             int64     `json:"id"`
	ErrorReportID  int64     `json:"errorReportId"`
	Sender         string    `json:"sender"`
	Message        string    `json:"message"`
	AdminUserID    *int64    `json:"adminUserId"`
	AdminUserLogin *string   `json:"adminUserLogin"`
	CreatedAt      time.Time `json:"createdAt"`
}

func (s *Store) CreateErrorReport(
	ctx context.Context,
	title *string,
	description, pageURL string,
	element json.RawMessage,
	screenshot []byte,
	screenshotContentType *string,
	viewportScreenshot []byte,
	viewportScreenshotContentType *string,
	userID *int64,
	approved bool,
) (ErrorReport, error) {
	var report ErrorReport
	var elementBytes []byte
	err := s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.error_report (
			title, description, page_url, element, screenshot, screenshot_content_type,
			viewport_screenshot, viewport_screenshot_content_type, user_id, approved
		)
		VALUES ($1, $2, $3, CAST($4 AS jsonb), $5, $6, $7, $8, $9, $10)
		RETURNING id, title, description, page_url, element, user_id, approved, status, resolution,
		          resolved_commit_sha, resolved_at, screenshot IS NOT NULL, screenshot_content_type,
		          viewport_screenshot IS NOT NULL, viewport_screenshot_content_type, created_at`,
		title, description, pageURL, string(element), screenshot, screenshotContentType,
		viewportScreenshot, viewportScreenshotContentType, userID, approved,
	).Scan(
		&report.ID,
		&report.Title,
		&report.Description,
		&report.PageURL,
		&elementBytes,
		&report.UserID,
		&report.Approved,
		&report.Status,
		&report.Resolution,
		&report.ResolvedCommitSHA,
		&report.ResolvedAt,
		&report.HasScreenshot,
		&report.ScreenshotContentType,
		&report.HasViewportScreenshot,
		&report.ViewportScreenshotContentType,
		&report.CreatedAt,
	)
	report.Element = json.RawMessage(elementBytes)
	report.Messages = []ErrorReportMessage{}
	return report, err
}

func (s *Store) ListErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	if err := s.requeueExpiredErrorReportClaims(ctx); err != nil {
		return nil, err
	}
	if err := s.archiveExpiredResolvedErrorReports(ctx); err != nil {
		return nil, err
	}
	return s.listErrorReports(ctx, limit, offset, false, false)
}

func (s *Store) ListApprovedErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	if err := s.requeueExpiredErrorReportClaims(ctx); err != nil {
		return nil, err
	}
	return s.listErrorReports(ctx, limit, offset, true, true)
}

func (s *Store) ListReviewerErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	if err := s.requeueExpiredErrorReportClaims(ctx); err != nil {
		return nil, err
	}
	if err := s.archiveExpiredResolvedErrorReports(ctx); err != nil {
		return nil, err
	}
	return s.listErrorReports(ctx, limit, offset, false, true)
}

func (s *Store) requeueExpiredErrorReportClaims(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report
		SET status = 'OPEN', processing_run_id = NULL,
		    processing_started_at = NULL, processing_expires_at = NULL
		WHERE status = 'IN_PROGRESS'
		  AND (processing_expires_at IS NULL OR processing_expires_at <= now())`)
	return err
}

func (s *Store) archiveExpiredResolvedErrorReports(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dndshare.error_report er
		SET status = 'ARCHIVED'
		WHERE status = 'RESOLVED' AND resolved_at <= now() - interval '1 hour'`)
	return err
}

func (s *Store) listErrorReports(ctx context.Context, limit, offset int, approvedOnly, reviewerVisibleOnly bool) ([]ErrorReport, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT er.id, er.title, er.description, er.page_url, er.element, er.user_id, u.login,
		       er.approved, er.status, er.processing_run_id, er.processing_started_at,
		       er.processing_expires_at, er.resolution, er.resolved_commit_sha, er.resolved_at,
		       er.screenshot IS NOT NULL, er.screenshot_content_type,
		       er.viewport_screenshot IS NOT NULL, er.viewport_screenshot_content_type,
		       COALESCE((
		           SELECT m.sender = 'AI'
		           FROM dndshare.error_report_message m
		           WHERE m.error_report_id = er.id
		           ORDER BY m.id DESC
		           LIMIT 1
		       ), false),
		       er.serious_change_reason, er.serious_change_requested_at,
		       er.serious_change_approved_at, er.serious_change_approved_by_user_id,
		       approver.login,
		       er.serious_change_requested_at IS NOT NULL AND er.serious_change_approved_at IS NULL,
		       er.created_at
		FROM dndshare.error_report er
		LEFT JOIN dndshare.users u ON u.id = er.user_id
		LEFT JOIN dndshare.users approver ON approver.id = er.serious_change_approved_by_user_id
		WHERE (NOT $4::bool OR er.status <> 'ARCHIVED')
		  AND (NOT $3::bool OR (
		    er.approved AND er.status = 'OPEN' AND COALESCE((
		        SELECT m.sender <> 'AI'
		        FROM dndshare.error_report_message m
		        WHERE m.error_report_id = er.id
		        ORDER BY m.id DESC
		        LIMIT 1
		    ), true)
		    AND (er.serious_change_requested_at IS NULL OR er.serious_change_approved_at IS NOT NULL)
		  ))
		ORDER BY er.created_at DESC, er.id DESC
		LIMIT $1 OFFSET $2`, limit, offset, approvedOnly, reviewerVisibleOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []ErrorReport
	var reportIDs []int64
	for rows.Next() {
		var report ErrorReport
		report.Messages = []ErrorReportMessage{}
		var elementBytes []byte
		if err := rows.Scan(
			&report.ID,
			&report.Title,
			&report.Description,
			&report.PageURL,
			&elementBytes,
			&report.UserID,
			&report.UserLogin,
			&report.Approved,
			&report.Status,
			&report.ProcessingRunID,
			&report.ProcessingStartedAt,
			&report.ProcessingExpiresAt,
			&report.Resolution,
			&report.ResolvedCommitSHA,
			&report.ResolvedAt,
			&report.HasScreenshot,
			&report.ScreenshotContentType,
			&report.HasViewportScreenshot,
			&report.ViewportScreenshotContentType,
			&report.WaitingForAnswer,
			&report.SeriousChangeReason,
			&report.SeriousChangeRequestedAt,
			&report.SeriousChangeApprovedAt,
			&report.SeriousChangeApprovedByUserID,
			&report.SeriousChangeApprovedByLogin,
			&report.WaitingForSeriousApproval,
			&report.CreatedAt,
		); err != nil {
			return nil, err
		}
		report.Element = json.RawMessage(elementBytes)
		reports = append(reports, report)
		reportIDs = append(reportIDs, report.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(reportIDs) == 0 {
		return reports, nil
	}
	messages, err := s.listErrorReportMessages(ctx, reportIDs)
	if err != nil {
		return nil, err
	}
	byReportID := make(map[int64][]ErrorReportMessage, len(reportIDs))
	for _, message := range messages {
		byReportID[message.ErrorReportID] = append(byReportID[message.ErrorReportID], message)
	}
	for i := range reports {
		if reportMessages := byReportID[reports[i].ID]; reportMessages != nil {
			reports[i].Messages = reportMessages
		}
	}
	return reports, nil
}

func (s *Store) listErrorReportMessages(ctx context.Context, reportIDs []int64) ([]ErrorReportMessage, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT m.id, m.error_report_id, m.sender, m.message, m.admin_user_id, u.login, m.created_at
		FROM dndshare.error_report_message m
		LEFT JOIN dndshare.users u ON u.id = m.admin_user_id
		WHERE m.error_report_id = ANY($1::bigint[])
		ORDER BY m.error_report_id, m.id`, reportIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]ErrorReportMessage, 0)
	for rows.Next() {
		var message ErrorReportMessage
		if err := rows.Scan(
			&message.ID,
			&message.ErrorReportID,
			&message.Sender,
			&message.Message,
			&message.AdminUserID,
			&message.AdminUserLogin,
			&message.CreatedAt,
		); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, rows.Err()
}

func (s *Store) CreateErrorReportAIQuestion(ctx context.Context, reportID int64, message string, leaseID *string) (ErrorReportMessage, error) {
	return s.createErrorReportMessage(ctx, reportID, ErrorReportMessageSenderAI, message, nil, true, leaseID)
}

func (s *Store) CreateErrorReportAdminAnswer(ctx context.Context, reportID, adminUserID int64, message string) (ErrorReportMessage, error) {
	return s.createErrorReportMessage(ctx, reportID, ErrorReportMessageSenderAdmin, message, &adminUserID, false, nil)
}

func (s *Store) createErrorReportMessage(ctx context.Context, reportID int64, sender, message string, adminUserID *int64, requireApproved bool, leaseID *string) (ErrorReportMessage, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ErrorReportMessage{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var approved bool
	var status string
	var processingRunID *string
	var latestSender string
	err = tx.QueryRow(ctx, `
		SELECT er.approved, er.status, er.processing_run_id, COALESCE((
		    SELECT m.sender
		    FROM dndshare.error_report_message m
		    WHERE m.error_report_id = er.id
		    ORDER BY m.id DESC
		    LIMIT 1
		), '')
		FROM dndshare.error_report er
		WHERE er.id = $1
		FOR UPDATE`, reportID).Scan(&approved, &status, &processingRunID, &latestSender)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrorReportMessage{}, ErrNotFound
	}
	if err != nil {
		return ErrorReportMessage{}, err
	}
	if requireApproved && !approved {
		return ErrorReportMessage{}, ErrNotFound
	}
	if sender == ErrorReportMessageSenderAdmin && status != ErrorReportStatusOpen {
		return ErrorReportMessage{}, ErrNotFound
	}
	if sender == ErrorReportMessageSenderAI {
		owned := status == ErrorReportStatusOpen && leaseID == nil
		if status == ErrorReportStatusInProgress && leaseID != nil && processingRunID != nil && *processingRunID == errorReportProcessingRunID(*leaseID) {
			var active bool
			if err := tx.QueryRow(ctx, `
				SELECT EXISTS (
				    SELECT 1 FROM dndshare.error_report_automation_lock
				    WHERE id = 1 AND token = $1 AND expires_at > now()
				)`, *leaseID).Scan(&active); err != nil {
				return ErrorReportMessage{}, err
			}
			owned = active
		}
		if !owned {
			return ErrorReportMessage{}, ErrNotFound
		}
	}
	if sender == ErrorReportMessageSenderAI && latestSender == ErrorReportMessageSenderAI {
		return ErrorReportMessage{}, ErrErrorReportAwaitingAnswer
	}
	if sender == ErrorReportMessageSenderAdmin && latestSender != ErrorReportMessageSenderAI {
		return ErrorReportMessage{}, ErrErrorReportNotAwaitingAnswer
	}

	var created ErrorReportMessage
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.error_report_message (error_report_id, sender, message, admin_user_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, error_report_id, sender, message, admin_user_id, created_at`,
		reportID, sender, message, adminUserID,
	).Scan(
		&created.ID,
		&created.ErrorReportID,
		&created.Sender,
		&created.Message,
		&created.AdminUserID,
		&created.CreatedAt,
	)
	if err != nil {
		return ErrorReportMessage{}, err
	}
	if sender == ErrorReportMessageSenderAI {
		if _, err := tx.Exec(ctx, `
			UPDATE dndshare.error_report
			SET status = 'OPEN', processing_run_id = NULL,
			    processing_started_at = NULL, processing_expires_at = NULL
			WHERE id = $1`, reportID); err != nil {
			return ErrorReportMessage{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return ErrorReportMessage{}, err
	}
	return created, nil
}

func (s *Store) GetErrorReportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, false, false, false)
}

func (s *Store) GetApprovedErrorReportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, true, false, false)
}

func (s *Store) GetReviewerErrorReportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, false, true, false)
}

func (s *Store) GetErrorReportViewportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, false, false, true)
}

func (s *Store) GetApprovedErrorReportViewportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, true, false, true)
}

func (s *Store) GetReviewerErrorReportViewportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, false, true, true)
}

func (s *Store) getErrorReportScreenshot(ctx context.Context, id int64, approvedOnly, reviewerVisibleOnly, viewport bool) ([]byte, string, error) {
	var screenshot []byte
	var contentType *string
	err := s.pool.QueryRow(ctx, `
		SELECT CASE WHEN $3::bool THEN viewport_screenshot ELSE screenshot END,
		       CASE WHEN $3::bool THEN viewport_screenshot_content_type ELSE screenshot_content_type END
		FROM dndshare.error_report
		WHERE id = $1
		  AND CASE WHEN $3::bool THEN viewport_screenshot IS NOT NULL ELSE screenshot IS NOT NULL END
		  AND (NOT $2::bool OR (approved AND status IN ('OPEN', 'IN_PROGRESS')))
		  AND (NOT $4::bool OR status <> 'ARCHIVED')`, id, approvedOnly, viewport, reviewerVisibleOnly,
	).Scan(&screenshot, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", ErrNotFound
	}
	if err != nil {
		return nil, "", err
	}
	if len(screenshot) == 0 {
		return nil, "", ErrNotFound
	}
	mime := "image/jpeg"
	if contentType != nil && *contentType != "" {
		mime = *contentType
	}
	return screenshot, mime, nil
}

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
