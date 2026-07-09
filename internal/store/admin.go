package store

import (
	"context"
	"time"
)

// AdminUser — строка для админ-панели (порт AdminPanelController.UserDto без ролей).
type AdminUser struct {
	ID        int64
	Login     string
	CreatedAt time.Time
}

// LogEntity — строка dndshare.logs.
type LogEntity struct {
	ID        int64      `json:"id"`
	Path      *string    `json:"path,omitempty"`
	Type      *string    `json:"type,omitempty"`
	Desc      *string    `json:"desc,omitempty"`
	Trace     *string    `json:"trace,omitempty"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
}

// AdminStats — счётчики для админ-панели.
type AdminStats struct {
	Users        int64 `json:"users"`
	Characters   int64 `json:"characters"`
	Templates    int64 `json:"templates"`
	BaseItems    int64 `json:"baseItems"`
	UserItems    int64 `json:"userItems"`
	BaseSuggests int64 `json:"baseSuggests"`
	UserSuggests int64 `json:"userSuggests"`
	Logs         int64 `json:"logs"`
}

// ListUsers возвращает всех пользователей (без хэшей).
func (s *Store) ListUsers(ctx context.Context) ([]AdminUser, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, login, COALESCE(created_at, now()) FROM dndshare.users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AdminUser
	for rows.Next() {
		var u AdminUser
		if err := rows.Scan(&u.ID, &u.Login, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// UpdateUserPassword ставит новый (уже захэшированный) пароль.
func (s *Store) UpdateUserPassword(ctx context.Context, id int64, hash string) error {
	_, err := s.pool.Exec(ctx, `UPDATE dndshare.users SET "password" = $2 WHERE id = $1`, id, hash)
	return err
}

// ListLogs возвращает последние логи в порядке убывания created_at (с ограничением, чтобы
// после года ошибок эндпоинт не тянул всю таблицу).
func (s *Store) ListLogs(ctx context.Context) ([]LogEntity, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, "path", "type", "desc", trace, created_at FROM dndshare.logs ORDER BY created_at DESC LIMIT 1000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []LogEntity
	for rows.Next() {
		var l LogEntity
		if err := rows.Scan(&l.ID, &l.Path, &l.Type, &l.Desc, &l.Trace, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) DeleteLog(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.logs WHERE id = $1`, id)
	return err
}

func (s *Store) DeleteAllLogs(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.logs`)
	return err
}

// GetAdminStats собирает счётчики для админ-панели.
func (s *Store) GetAdminStats(ctx context.Context) (AdminStats, error) {
	var st AdminStats
	err := s.pool.QueryRow(ctx, `SELECT
		(SELECT COUNT(*) FROM dndshare.users),
		(SELECT COUNT(*) FROM dndshare."char" WHERE deleted = false),
		(SELECT COUNT(*) FROM dndshare.char_template),
		(SELECT COUNT(*) FROM dndshare.item WHERE user_id IS NULL),
		(SELECT COUNT(*) FROM dndshare.item WHERE user_id IS NOT NULL),
		(SELECT COUNT(*) FROM dndshare.suggest WHERE user_id IS NULL),
		(SELECT COUNT(*) FROM dndshare.suggest WHERE user_id IS NOT NULL),
		(SELECT COUNT(*) FROM dndshare.logs)`,
	).Scan(&st.Users, &st.Characters, &st.Templates, &st.BaseItems, &st.UserItems, &st.BaseSuggests, &st.UserSuggests, &st.Logs)
	return st, err
}
