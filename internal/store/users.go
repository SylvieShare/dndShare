package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// User — строка dndshare.users.
type User struct {
	ID        int64
	Login     string
	Password  string
	CreatedAt string
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

// CheckSession — валиден ли (userId, uuid) как активная сессия.
func (s *Store) CheckSession(ctx context.Context, userID int64, session string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare.users_session WHERE user_id = $1 AND "session" = $2)`,
		userID, session,
	).Scan(&exists)
	return exists, err
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
