package store

import "context"

// HasApprovedErrorReports is the cheap pre-lock queue probe used by MCP.
// It deliberately avoids materializing report payloads and message history.
func (s *Store) HasApprovedErrorReports(ctx context.Context) (bool, error) {
	if err := s.requeueExpiredErrorReportClaims(ctx); err != nil {
		return false, err
	}
	var hasReports bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM dndshare.error_report er
			WHERE er.approved
			  AND er.status = 'OPEN'
			  AND COALESCE((
			      SELECT m.sender <> 'AI'
			      FROM dndshare.error_report_message m
			      WHERE m.error_report_id = er.id
			      ORDER BY m.id DESC
			      LIMIT 1
			  ), true)
			  AND (er.serious_change_requested_at IS NULL
			       OR er.serious_change_approved_at IS NOT NULL)
		)`).Scan(&hasReports)
	return hasReports, err
}
