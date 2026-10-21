package store

import "context"

// A timeline ID is assigned before its transaction commits. Rechecking the
// visible window also catches lower IDs committed after a later cursor.
func (s *Store) RecentSessionEvents(ctx context.Context, sessionID, userID int64) ([]SessionEvent, error) {
	rows, err := s.pool.Query(ctx, sessionEventSelect+sessionEventReadAccess+` AND e.session_id=$1 ORDER BY e.id DESC LIMIT 200`, sessionID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []SessionEvent{}
	for rows.Next() {
		event, err := scanSessionEvent(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}
