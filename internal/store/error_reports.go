package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"
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
		title, description, pageURL, element, screenshot, screenshotContentType,
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
	return s.listErrorReports(ctx, limit, offset, false, false, 0)
}

func (s *Store) ListApprovedErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	if err := s.requeueExpiredErrorReportClaims(ctx); err != nil {
		return nil, err
	}
	return s.listErrorReports(ctx, limit, offset, true, true, 0)
}

func (s *Store) ListReviewerErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	if err := s.requeueExpiredErrorReportClaims(ctx); err != nil {
		return nil, err
	}
	if err := s.archiveExpiredResolvedErrorReports(ctx); err != nil {
		return nil, err
	}
	return s.listErrorReports(ctx, limit, offset, false, true, 0)
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

func (s *Store) listErrorReports(ctx context.Context, limit, offset int, approvedOnly, reviewerVisibleOnly bool, reportID int64) ([]ErrorReport, error) {
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
		WHERE ($5::bigint = 0 OR er.id = $5)
		  AND (NOT $4::bool OR er.status <> 'ARCHIVED')
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
		LIMIT $1 OFFSET $2`, limit, offset, approvedOnly, reviewerVisibleOnly, reportID)
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
