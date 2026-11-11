package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

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
