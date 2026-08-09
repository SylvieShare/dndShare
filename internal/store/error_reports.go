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
	ID                    int64                `json:"id"`
	Description           string               `json:"description"`
	PageURL               string               `json:"pageUrl"`
	Element               json.RawMessage      `json:"element"`
	UserID                *int64               `json:"userId"`
	UserLogin             *string              `json:"userLogin"`
	Approved              bool                 `json:"approved"`
	HasScreenshot         bool                 `json:"hasScreenshot"`
	ScreenshotContentType *string              `json:"screenshotContentType,omitempty"`
	Messages              []ErrorReportMessage `json:"messages"`
	WaitingForAnswer      bool                 `json:"waitingForAnswer"`
	CreatedAt             time.Time            `json:"createdAt"`
}

const (
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

func (s *Store) CreateErrorReport(ctx context.Context, description, pageURL string, element json.RawMessage, screenshot []byte, screenshotContentType *string, userID *int64, approved bool) (ErrorReport, error) {
	var report ErrorReport
	var elementBytes []byte
	err := s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.error_report (description, page_url, element, screenshot, screenshot_content_type, user_id, approved)
		VALUES ($1, $2, CAST($3 AS jsonb), $4, $5, $6, $7)
		RETURNING id, description, page_url, element, user_id, approved, screenshot IS NOT NULL, screenshot_content_type, created_at`,
		description, pageURL, string(element), screenshot, screenshotContentType, userID, approved,
	).Scan(&report.ID, &report.Description, &report.PageURL, &elementBytes, &report.UserID, &report.Approved, &report.HasScreenshot, &report.ScreenshotContentType, &report.CreatedAt)
	report.Element = json.RawMessage(elementBytes)
	report.Messages = []ErrorReportMessage{}
	return report, err
}

func (s *Store) ListErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	return s.listErrorReports(ctx, limit, offset, false)
}

func (s *Store) ListApprovedErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	return s.listErrorReports(ctx, limit, offset, true)
}

func (s *Store) listErrorReports(ctx context.Context, limit, offset int, approvedOnly bool) ([]ErrorReport, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT er.id, er.description, er.page_url, er.element, er.user_id, u.login,
		       er.approved, er.screenshot IS NOT NULL, er.screenshot_content_type,
		       COALESCE((
		           SELECT m.sender = 'AI'
		           FROM dndshare.error_report_message m
		           WHERE m.error_report_id = er.id
		           ORDER BY m.id DESC
		           LIMIT 1
		       ), false), er.created_at
		FROM dndshare.error_report er
		LEFT JOIN dndshare.users u ON u.id = er.user_id
		WHERE NOT $3::bool OR (
		    er.approved AND COALESCE((
		        SELECT m.sender <> 'AI'
		        FROM dndshare.error_report_message m
		        WHERE m.error_report_id = er.id
		        ORDER BY m.id DESC
		        LIMIT 1
		    ), true)
		)
		ORDER BY er.created_at DESC, er.id DESC
		LIMIT $1 OFFSET $2`, limit, offset, approvedOnly)
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
			&report.Description,
			&report.PageURL,
			&elementBytes,
			&report.UserID,
			&report.UserLogin,
			&report.Approved,
			&report.HasScreenshot,
			&report.ScreenshotContentType,
			&report.WaitingForAnswer,
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

func (s *Store) CreateErrorReportAIQuestion(ctx context.Context, reportID int64, message string) (ErrorReportMessage, error) {
	return s.createErrorReportMessage(ctx, reportID, ErrorReportMessageSenderAI, message, nil, true)
}

func (s *Store) CreateErrorReportAdminAnswer(ctx context.Context, reportID, adminUserID int64, message string) (ErrorReportMessage, error) {
	return s.createErrorReportMessage(ctx, reportID, ErrorReportMessageSenderAdmin, message, &adminUserID, false)
}

func (s *Store) createErrorReportMessage(ctx context.Context, reportID int64, sender, message string, adminUserID *int64, requireApproved bool) (ErrorReportMessage, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ErrorReportMessage{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var approved bool
	var latestSender string
	err = tx.QueryRow(ctx, `
		SELECT er.approved, COALESCE((
		    SELECT m.sender
		    FROM dndshare.error_report_message m
		    WHERE m.error_report_id = er.id
		    ORDER BY m.id DESC
		    LIMIT 1
		), '')
		FROM dndshare.error_report er
		WHERE er.id = $1
		FOR UPDATE`, reportID).Scan(&approved, &latestSender)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrorReportMessage{}, ErrNotFound
	}
	if err != nil {
		return ErrorReportMessage{}, err
	}
	if requireApproved && !approved {
		return ErrorReportMessage{}, ErrNotFound
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
	if err := tx.Commit(ctx); err != nil {
		return ErrorReportMessage{}, err
	}
	return created, nil
}

func (s *Store) GetErrorReportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, false)
}

func (s *Store) GetApprovedErrorReportScreenshot(ctx context.Context, id int64) ([]byte, string, error) {
	return s.getErrorReportScreenshot(ctx, id, true)
}

func (s *Store) getErrorReportScreenshot(ctx context.Context, id int64, approvedOnly bool) ([]byte, string, error) {
	var screenshot []byte
	var contentType *string
	err := s.pool.QueryRow(ctx, `
		SELECT screenshot, screenshot_content_type
		FROM dndshare.error_report
		WHERE id = $1 AND screenshot IS NOT NULL AND (NOT $2::bool OR approved)`, id, approvedOnly,
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
