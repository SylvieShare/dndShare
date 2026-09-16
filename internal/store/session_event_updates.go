package store

import "context"

// Transfers and RPS challenges change status without changing their timeline ID.
// Return their projections separately so they do not consume the new-event page.
func (s *Store) SessionMutableEventUpdates(ctx context.Context, sessionID, userID, afterID int64) ([]SessionEvent, error) {
	result := []SessionEvent{}
	if afterID <= 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx, sessionEventSelect+sessionEventReadAccess+` AND e.session_id=$1 AND e.id<=$3 AND (e.event_type IN ('item_transfer','rps_challenge') OR e.data ? 'savingThrow' OR e.data ? 'damageRoll' OR e.data ? 'attackRoll' OR e.data ? 'impacts') ORDER BY e.id DESC LIMIT 200`, sessionID, userID, afterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		event, err := scanSessionEvent(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}
