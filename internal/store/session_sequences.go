package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// A command locks the whole cast. Repeated requests keep their original rolls;
// a stale tab cannot select a different type or advance the chain twice.
func (s *Store) AdvanceSessionSequence(ctx context.Context, userID, sessionID, eventID int64, cmd SequenceCommand) (SessionEvent, error) {
	var available []ApplicationTarget
	if cmd.Action == "target" {
		var err error
		available, err = s.sessionChronicleTargets(ctx, userID, sessionID)
		if err != nil {
			return SessionEvent{}, err
		}
		canonical, err := canonicalAttackTargets([]ApplicationTarget{cmd.Target}, available)
		if err != nil || len(canonical) != 1 {
			return SessionEvent{}, ErrApplication
		}
		cmd.Target = canonical[0]
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionEvent{}, err
	}
	defer tx.Rollback(ctx)
	var settings SessionSettings
	var ownerID int64
	err = tx.QueryRow(ctx, `SELECT settings,owner_user_id FROM dndshare."session" WHERE id=$1 AND NOT deleted FOR UPDATE`, sessionID).Scan(&settings, &ownerID)
	if err != nil {
		return SessionEvent{}, err
	}
	var raw json.RawMessage
	var authorID int64
	var actorUUID, actorName string
	err = tx.QueryRow(ctx, `SELECT e.data,e.author_user_id,COALESCE(c.uuid::text,''),COALESCE(e.actor_name,'Мастер') FROM dndshare.session_event e LEFT JOIN dndshare."char" c ON c.id=e.actor_char_id
 WHERE e.id=$1 AND e.session_id=$2 AND NOT e.deleted FOR UPDATE OF e`, eventID, sessionID).Scan(&raw, &authorID, &actorUUID, &actorName)
	if err != nil {
		return SessionEvent{}, err
	}
	if userID != ownerID && (userID != authorID || cmd.Action != "type") {
		return SessionEvent{}, ErrNotFound
	}
	data := map[string]any{}
	if json.Unmarshal(raw, &data) != nil {
		return SessionEvent{}, ErrApplication
	}
	seq := object(data["sequence"])
	receipts := object(seq["requests"])
	signature, _ := json.Marshal(cmd)
	if previous, ok := receipts[cmd.ClientActionID]; ok {
		if previous != string(signature) {
			return SessionEvent{}, ErrApplication
		}
		return scanSessionEvent(tx.QueryRow(ctx, sessionEventSelect+` AND e.id=$1`, eventID))
	}
	if number(seq["revision"]) != cmd.Revision || len(receipts) >= 500 {
		return SessionEvent{}, fmt.Errorf("%w: состояние изменилось, обновите хронику", ErrApplication)
	}
	hits := array(seq["hits"])
	if len(hits) < 1 {
		return SessionEvent{}, ErrApplication
	}
	if cmd.Action == "target" && object(hits[len(hits)-1])["attack"] == nil {
		key := fmt.Sprintf("dm:%d", authorID)
		if actorUUID != "" {
			key = "char:" + actorUUID
		}
		if uid := textValue(object(data["npcActor"])["uid"]); uid != "" {
			key = "npc:" + uid
		}
		attack, err := karmicSequenceAttack(ctx, tx, sessionID, settings.KarmicDice, key, actorName, seq, cmd.Mode)
		if err != nil {
			return SessionEvent{}, err
		}
		object(hits[len(hits)-1])["attack"] = attack
	}
	if cmd.Action == "type" {
		hit := object(hits[len(hits)-1])
		if hit["status"] != "choice" {
			return SessionEvent{}, ErrApplication
		}
		if err = resolveSequenceType(ctx, tx, hit, cmd.TypeID); err != nil {
			return SessionEvent{}, err
		}
	} else if err = advanceSequence(seq, cmd, secureApplicationDie); err != nil {
		return SessionEvent{}, err
	}
	hits = array(seq["hits"])
	hit := object(hits[len(hits)-1])
	if hit["status"] == "choice" && len(array(hit["choices"])) == 1 {
		if err = resolveSequenceType(ctx, tx, hit, number(object(array(hit["choices"])[0])["id"])); err != nil {
			return SessionEvent{}, err
		}
	}
	hit["canContinue"] = sequenceCanContinue(seq, hit)
	if limit := sequenceJumpLimit(seq); limit > 0 {
		seq["jumpLimit"] = limit
	}
	receipts[cmd.ClientActionID], seq["requests"], seq["revision"] = string(signature), receipts, cmd.Revision+1
	raw, err = json.Marshal(data)
	if err != nil {
		return SessionEvent{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.session_event SET data=CAST($2 AS jsonb) WHERE id=$1`, eventID, raw); err != nil {
		return SessionEvent{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionEvent{}, err
	}
	return scanSessionEvent(s.pool.QueryRow(ctx, sessionEventSelect+` AND e.id=$1`, eventID))
}

func resolveSequenceType(ctx context.Context, tx pgx.Tx, hit map[string]any, id int) error {
	var label, color string
	if err := tx.QueryRow(ctx, `SELECT value,COALESCE(color,'') FROM dndshare.suggest WHERE type_id=12 AND id=$1 AND user_id IS NULL`, id).Scan(&label, &color); err != nil {
		return err
	}
	return sequenceSelectType(hit, id, label, color)
}
