package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
)

// The versioned encounter update and its presentation/timeline effects commit
// together. A lost HTTP response cannot leave half of a start/finish command.
func commitEncounterEffects(ctx context.Context, tx pgx.Tx, sessionID int64, previous, next json.RawMessage, round int) error {
	var before, after struct {
		Active bool `json:"active"`
	}
	if len(previous) > 0 {
		if err := json.Unmarshal(previous, &before); err != nil {
			return err
		}
	}
	if err := json.Unmarshal(next, &after); err != nil {
		return err
	}
	if before.Active == after.Active {
		return nil
	}
	if err := setCombatPresentationActive(ctx, tx, sessionID, after.Active); err != nil {
		return err
	}
	actor, ok := ctx.Value(documentActorKey{}).(int64)
	if !ok {
		return ErrNotFound
	}
	kind, title := "encounter_finished", "Бой завершён"
	if after.Active {
		kind, title = "encounter_started", "Бой начался"
	}
	data, _ := json.Marshal(map[string]any{"round": round})
	_, err := tx.Exec(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,event_type,action,data,visibility) VALUES($1,$2,$3,$4,$5::jsonb,'public')`, sessionID, actor, kind, title, json.RawMessage(data))
	return err
}
