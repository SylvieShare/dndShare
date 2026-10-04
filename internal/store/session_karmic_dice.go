package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type SessionD20Request struct {
	RequestID string `json:"requestId"`
	Kind      string `json:"kind"`
	Mode      string `json:"mode"`
	CharUUID  string `json:"charUuid,omitempty"`
	NPCUID    string `json:"npcUid,omitempty"`
	Previous  *int   `json:"previous,omitempty"`
}

type SessionD20Result struct {
	Rolls         []int `json:"rolls"`
	Karmic        bool  `json:"karmic"`
	BalanceBefore int   `json:"balanceBefore"`
	BalanceAfter  int   `json:"balanceAfter"`
}

type SessionKarmicScale struct {
	Key     string `json:"key"`
	Name    string `json:"name"`
	Balance int    `json:"balance"`
}

func ValidSessionD20Request(req SessionD20Request) bool {
	if req.Kind != "attack" && req.Kind != "ability_check" && req.Kind != "saving_throw" {
		return false
	}
	if req.Mode != "normal" && req.Mode != "advantage" && req.Mode != "disadvantage" {
		return false
	}
	if req.CharUUID != "" && req.NPCUID != "" {
		return false
	}
	if len(req.NPCUID) > 160 {
		return false
	}
	return req.Previous == nil || (*req.Previous >= 1 && *req.Previous <= 20 && req.Mode != "normal")
}

// The session row serializes settings, shared rolls and individual rolls. The
// receipt makes retries after a lost response return the same dice and balance.
func (s *Store) RollSessionD20(ctx context.Context, sessionID, userID int64, req SessionD20Request) (SessionD20Result, error) {
	var result SessionD20Result
	if !ValidSessionD20Request(req) {
		return result, ErrApplication
	}
	var charUUID *string
	if req.CharUUID != "" {
		charUUID = &req.CharUUID
	}
	_, name, err := s.ResolveSessionActor(ctx, sessionID, userID, charUUID)
	if err != nil {
		return result, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	var settings SessionSettings
	var ownerID int64
	err = tx.QueryRow(ctx, `SELECT settings,owner_user_id FROM dndshare."session" WHERE id=$1 AND NOT deleted FOR UPDATE`, sessionID).Scan(&settings, &ownerID)
	if err != nil {
		return result, err
	}
	rawRequest, err := json.Marshal(req)
	if err != nil {
		return result, err
	}
	var rawResult json.RawMessage
	var matches bool
	err = tx.QueryRow(ctx, `SELECT result, user_id=$3 AND request=CAST($4 AS jsonb) FROM dndshare.session_d20_roll WHERE session_id=$1 AND request_id=$2::uuid`, sessionID, req.RequestID, userID, json.RawMessage(rawRequest)).Scan(&rawResult, &matches)
	if err == nil {
		if !matches {
			return result, ErrApplication
		}
		err = json.Unmarshal(rawResult, &result)
		return result, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	key, label := fmt.Sprintf("dm:%d", userID), "Мастер"
	if charUUID != nil {
		key, label = "char:"+req.CharUUID, *name
	}
	if req.NPCUID != "" {
		if ownerID != userID {
			return result, ErrNotFound
		}
		key, label, err = karmicNPCActor(ctx, tx, sessionID, req.NPCUID)
		if err != nil {
			return result, err
		}
	}
	result, err = rollSessionD20Tx(ctx, tx, sessionID, settings.KarmicDice, key, label, req.Mode, req.Previous)
	if err != nil {
		return result, err
	}
	rawResult, err = json.Marshal(result)
	if err != nil {
		return result, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.session_d20_roll(session_id,request_id,user_id,request,result) VALUES($1,$2::uuid,$3,CAST($4 AS jsonb),CAST($5 AS jsonb))`, sessionID, req.RequestID, userID, json.RawMessage(rawRequest), rawResult)
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

func keptD20(a, b int, mode string) int {
	if mode == "disadvantage" {
		return min(a, b)
	}
	return max(a, b)
}

func karmicNPCActor(ctx context.Context, tx pgx.Tx, sessionID int64, uid string) (string, string, error) {
	var raw json.RawMessage
	if err := tx.QueryRow(ctx, `SELECT data FROM dndshare.session_encounter WHERE session_id=$1 AND NOT deleted ORDER BY id DESC LIMIT 1`, sessionID).Scan(&raw); err != nil {
		return "", "", ErrNotFound
	}
	var enc map[string]any
	if err := json.Unmarshal(raw, &enc); err != nil {
		return "", "", err
	}
	for _, row := range array(enc["combatants"]) {
		c := object(row)
		if c["type"] != "npc" || textValue(c["uid"]) != uid || c["position"] == "dead" {
			continue
		}
		name := textValue(object(c["override"])["name"])
		if name == "" && number(c["itemId"]) > 0 {
			if err := tx.QueryRow(ctx, `SELECT name FROM dndshare.item WHERE id=$1`, number(c["itemId"])).Scan(&name); err != nil {
				return "", "", err
			}
		}
		if name == "" {
			name = "Существо"
		}
		if letter := textValue(c["markerLetter"]); letter != "" {
			name = letter + " · " + name
		}
		return "npc:" + uid, name, nil
	}
	return "", "", ErrNotFound
}

func (s *Store) SessionKarmicScales(ctx context.Context, sessionID int64) ([]SessionKarmicScale, error) {
	rows, err := s.pool.Query(ctx, `SELECT actor_key,actor_name,balance FROM dndshare.session_karmic_scale WHERE session_id=$1 ORDER BY actor_name,actor_key`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	scales := []SessionKarmicScale{}
	for rows.Next() {
		var scale SessionKarmicScale
		if err := rows.Scan(&scale.Key, &scale.Name, &scale.Balance); err != nil {
			return nil, err
		}
		scales = append(scales, scale)
	}
	return scales, rows.Err()
}
