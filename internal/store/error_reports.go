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
	ID                    int64           `json:"id"`
	Description           string          `json:"description"`
	PageURL               string          `json:"pageUrl"`
	Element               json.RawMessage `json:"element"`
	UserID                *int64          `json:"userId"`
	UserLogin             *string         `json:"userLogin"`
	Approved              bool            `json:"approved"`
	HasScreenshot         bool            `json:"hasScreenshot"`
	ScreenshotContentType *string         `json:"screenshotContentType,omitempty"`
	CreatedAt             time.Time       `json:"createdAt"`
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
		       er.approved, er.screenshot IS NOT NULL, er.screenshot_content_type, er.created_at
		FROM dndshare.error_report er
		LEFT JOIN dndshare.users u ON u.id = er.user_id
		WHERE NOT $3::bool OR er.approved
		ORDER BY er.created_at DESC, er.id DESC
		LIMIT $1 OFFSET $2`, limit, offset, approvedOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []ErrorReport
	for rows.Next() {
		var report ErrorReport
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
			&report.CreatedAt,
		); err != nil {
			return nil, err
		}
		report.Element = json.RawMessage(elementBytes)
		reports = append(reports, report)
	}
	return reports, rows.Err()
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
