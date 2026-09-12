package store

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
)

var displayCodePattern = regexp.MustCompile(`^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$`)

func NormalizeDisplayCode(code string) (string, bool) {
	if !displayCodePattern.MatchString(code) {
		return "", false
	}
	return strings.ToUpper(code), true
}

func (s *Store) GetGameSessionByDisplayCode(ctx context.Context, code string) (GameSession, error) {
	code, valid := NormalizeDisplayCode(code)
	if !valid {
		return GameSession{}, ErrNotFound
	}
	session, err := scanGameSession(s.pool.QueryRow(ctx,
		sessionSelect+` WHERE s.display_code = $1 AND s.deleted = false`, code))
	if errors.Is(err, pgx.ErrNoRows) {
		return GameSession{}, ErrNotFound
	}
	return session, err
}

func insertSessionWithDisplayCode(ctx context.Context, tx pgx.Tx, userID int64, name string, description *string, systemID *int64) (int64, string, error) {
	for attempt := 0; attempt < 10; attempt++ {
		var id int64
		var uuid string
		err := tx.QueryRow(ctx, `
			INSERT INTO dndshare.session (owner_user_id, name, description, system_id, invite_code)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (display_code) DO NOTHING RETURNING id, uuid::text`,
			userID, name, description, systemID, generateInviteCode()).Scan(&id, &uuid)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		return id, uuid, err
	}
	return 0, "", errors.New("could not allocate a unique display code")
}
