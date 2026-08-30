package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

const SessionLifetime = 30 * 24 * time.Hour

// User — строка dndshare.users.
type User struct {
	ID        int64
	Login     string
	Password  string
	CreatedAt string
}

// UserGameContext is the player's selected game system and concrete edition.
type UserGameContext struct {
	SourceID        int64  `json:"sourceId"`
	SourceName      string `json:"sourceName"`
	SourceVersionID int64  `json:"sourceVersionId"`
	Version         string `json:"version"`
}

const userGameContextQuery = `SELECT src.id, src.name, sv.id, sv.version
	FROM dndshare.users u
	JOIN dndshare.source_version sv ON sv.id = u.source_version_id
	JOIN dndshare.source src ON src.id = sv.source_id`

// GetUserGameContext returns the rules edition selected by one player.
func (s *Store) GetUserGameContext(ctx context.Context, userID int64) (UserGameContext, error) {
	var result UserGameContext
	err := s.pool.QueryRow(ctx, userGameContextQuery+` WHERE u.id = $1`, userID).
		Scan(&result.SourceID, &result.SourceName, &result.SourceVersionID, &result.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return UserGameContext{}, ErrNotFound
	}
	return result, err
}

// UpdateUserGameContext changes the selected edition and returns its full context.
func (s *Store) UpdateUserGameContext(ctx context.Context, userID, sourceVersionID int64) (UserGameContext, error) {
	result, err := s.pool.Exec(ctx,
		`UPDATE dndshare.users SET source_version_id = $2 WHERE id = $1`,
		userID, sourceVersionID,
	)
	if err != nil {
		return UserGameContext{}, err
	}
	if result.RowsAffected() == 0 {
		return UserGameContext{}, ErrNotFound
	}
	return s.GetUserGameContext(ctx, userID)
}

// FindUserByLogin возвращает пользователя по логину (nil-ошибка ErrNotFound, если нет).
func (s *Store) FindUserByLogin(ctx context.Context, login string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, login, "password" FROM dndshare.users WHERE login = $1`, login,
	).Scan(&u.ID, &u.Login, &u.Password)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

// FindUserByID возвращает пользователя по id.
func (s *Store) FindUserByID(ctx context.Context, id int64) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`SELECT id, login, "password" FROM dndshare.users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Login, &u.Password)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

// GetUserLogins returns display logins for a set of user IDs.
func (s *Store) GetUserLogins(ctx context.Context, ids []int64) (map[int64]string, error) {
	result := make(map[int64]string)
	if len(ids) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, login FROM dndshare.users WHERE id = ANY($1)`,
		ids,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var login string
		if err := rows.Scan(&id, &login); err != nil {
			return nil, err
		}
		result[id] = login
	}
	return result, rows.Err()
}

// ExistsByLogin — есть ли пользователь с таким логином.
func (s *Store) ExistsByLogin(ctx context.Context, login string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare.users WHERE login = $1)`, login,
	).Scan(&exists)
	return exists, err
}

// CreateUser сохраняет нового пользователя с уже захэшированным паролем.
func (s *Store) CreateUser(ctx context.Context, login, passwordHash string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.users (login, "password") VALUES ($1, $2) RETURNING id, login, "password"`,
		login, passwordHash,
	).Scan(&u.ID, &u.Login, &u.Password)
	return u, err
}

// CreateSession генерирует серверную сессию (users_session) и возвращает её uuid-токен.
func (s *Store) CreateSession(ctx context.Context, userID int64, session string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dndshare.users_session (user_id, "session") VALUES ($1, $2)`,
		userID, session,
	)
	return err
}

// CheckSession — валиден ли (userId, uuid) как активная и неистёкшая сессия.
func (s *Store) CheckSession(ctx context.Context, userID int64, session string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM dndshare.users_session
			WHERE user_id = $1 AND "session" = $2 AND created_at >= $3
		)`,
		userID, session, time.Now().Add(-SessionLifetime),
	).Scan(&exists)
	return exists, err
}

// DeleteExpiredSessions removes server-side state that can no longer authenticate.
func (s *Store) DeleteExpiredSessions(ctx context.Context) (int64, error) {
	result, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.users_session WHERE created_at < $1`,
		time.Now().Add(-SessionLifetime),
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// UpdateUserPasswordAndReplaceSession changes a password, revokes every existing
// session and installs one fresh session for the current browser atomically.
func (s *Store) UpdateUserPasswordAndReplaceSession(ctx context.Context, userID int64, hash, session string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	result, err := tx.Exec(ctx, `UPDATE dndshare.users SET "password" = $2 WHERE id = $1`, userID, hash)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.users_session WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO dndshare.users_session (user_id, "session") VALUES ($1, $2)`,
		userID, session,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// DeleteSession удаляет конкретную сессию (при logout).
func (s *Store) DeleteSession(ctx context.Context, userID int64, session string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.users_session WHERE user_id = $1 AND "session" = $2`,
		userID, session,
	)
	return err
}

// RolesByUser возвращает имена ролей пользователя (ADMIN, HANDBOOK_ADMIN, ...).
func (s *Store) RolesByUser(ctx context.Context, userID int64) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT r.name FROM dndshare.users_role ur JOIN dndshare.role r ON r.id = ur.role_id WHERE ur.user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		roles = append(roles, name)
	}
	return roles, rows.Err()
}

// RolesByAllUsers — карта userId -> роли (для админ-панели).
func (s *Store) RolesByAllUsers(ctx context.Context) (map[int64][]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT ur.user_id, r.name FROM dndshare.users_role ur JOIN dndshare.role r ON r.id = ur.role_id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64][]string{}
	for rows.Next() {
		var uid int64
		var name string
		if err := rows.Scan(&uid, &name); err != nil {
			return nil, err
		}
		result[uid] = append(result[uid], name)
	}
	return result, rows.Err()
}

// AddRole назначает роль по её имени (idempotent).
func (s *Store) AddRole(ctx context.Context, userID int64, role string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dndshare.users_role (user_id, role_id)
		 SELECT $1, r.id FROM dndshare.role r WHERE r.name = $2
		 ON CONFLICT DO NOTHING`,
		userID, role,
	)
	return err
}

// RemoveRole снимает роль по её имени.
func (s *Store) RemoveRole(ctx context.Context, userID int64, role string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.users_role ur USING dndshare.role r
		 WHERE ur.role_id = r.id AND ur.user_id = $1 AND r.name = $2`,
		userID, role,
	)
	return err
}

// LogError пишет запись в dndshare.logs (аналог RestResponseEntityExceptionHandler).
func (s *Store) LogError(ctx context.Context, path, typ, desc, trace string) {
	_, _ = s.pool.Exec(ctx,
		`INSERT INTO dndshare.logs ("path", "type", "desc", trace) VALUES ($1, $2, $3, $4)`,
		path, typ, desc, trace,
	)
}
