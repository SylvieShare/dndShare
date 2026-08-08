package store

import (
	"context"
	"encoding/json"
	"time"
)

// ErrorReport is a user-submitted pointer to a broken element on a page.
// Element stays as JSON so the browser can include selector and accessibility
// metadata without requiring a schema migration for every new diagnostic field.
type ErrorReport struct {
	ID          int64           `json:"id"`
	Description string          `json:"description"`
	PageURL     string          `json:"pageUrl"`
	Element     json.RawMessage `json:"element"`
	UserID      *int64          `json:"userId,omitempty"`
	UserLogin   *string         `json:"userLogin,omitempty"`
	CreatedAt   time.Time       `json:"createdAt"`
}

func (s *Store) CreateErrorReport(ctx context.Context, description, pageURL string, element json.RawMessage, userID *int64) (ErrorReport, error) {
	var report ErrorReport
	var elementBytes []byte
	err := s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.error_report (description, page_url, element, user_id)
		VALUES ($1, $2, CAST($3 AS jsonb), $4)
		RETURNING id, description, page_url, element, user_id, created_at`,
		description, pageURL, string(element), userID,
	).Scan(&report.ID, &report.Description, &report.PageURL, &elementBytes, &report.UserID, &report.CreatedAt)
	report.Element = json.RawMessage(elementBytes)
	return report, err
}

func (s *Store) ListErrorReports(ctx context.Context, limit, offset int) ([]ErrorReport, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT er.id, er.description, er.page_url, er.element, er.user_id, u.login, er.created_at
		FROM dndshare.error_report er
		LEFT JOIN dndshare.users u ON u.id = er.user_id
		ORDER BY er.created_at DESC, er.id DESC
		LIMIT $1 OFFSET $2`, limit, offset)
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
			&report.CreatedAt,
		); err != nil {
			return nil, err
		}
		report.Element = json.RawMessage(elementBytes)
		reports = append(reports, report)
	}
	return reports, rows.Err()
}

func (s *Store) DeleteErrorReport(ctx context.Context, id int64) (bool, error) {
	result, err := s.pool.Exec(ctx, `DELETE FROM dndshare.error_report WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	return result.RowsAffected() > 0, nil
}
