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
	Users        int64             `json:"users"`
	Characters   int64             `json:"characters"`
	Templates    int64             `json:"templates"`
	BaseItems    int64             `json:"baseItems"`
	UserItems    int64             `json:"userItems"`
	BaseSuggests int64             `json:"baseSuggests"`
	UserSuggests int64             `json:"userSuggests"`
	Logs         int64             `json:"logs"`
	ErrorReports int64             `json:"errorReports"`
	Storage      AdminStorageStats `json:"storage"`
}

type AdminStorageCategory struct {
	Key              string `json:"key"`
	Label            string `json:"label"`
	Bytes            int64  `json:"bytes"`
	FileCount        int64  `json:"fileCount"`
	UnknownFileCount int64  `json:"unknownFileCount"`
}

type AdminStorageStats struct {
	UsedBytes        int64                  `json:"usedBytes"`
	FileCount        int64                  `json:"fileCount"`
	UnknownFileCount int64                  `json:"unknownFileCount"`
	Breakdown        []AdminStorageCategory `json:"breakdown"`
}

const adminStorageStatsQuery = `
	WITH stored_files AS (
		SELECT CASE
				WHEN image."type" = 'video' OR image.mime_type LIKE 'video/%' THEN 'video'
				WHEN image.user_id IS NULL THEN 'systemImages'
				ELSE 'userImages'
			END AS category,
			image.file_size
		FROM dndshare.storage_image image
		WHERE image.deleted = false
		  AND (image."key" IS NOT NULL OR image.bytes IS NOT NULL)
		UNION ALL
		SELECT 'svg', svg.file_size
		FROM dndshare.svg_storage svg
		UNION ALL
		SELECT CASE WHEN track.is_system THEN 'systemMusic' ELSE 'userMusic' END,
			track.file_size
		FROM dndshare.music_track track
	), categories(category, label, sort_order) AS (VALUES
		('systemImages', 'Системные изображения', 1),
		('userImages', 'Пользовательские изображения', 2),
		('video', 'Видео', 3),
		('systemMusic', 'Системная музыка', 4),
		('userMusic', 'Пользовательская музыка', 5),
		('svg', 'SVG-иконки', 6)
	)
	SELECT categories.category,
	       categories.label,
	       COALESCE(SUM(stored_files.file_size), 0)::bigint,
	       COUNT(stored_files.category)::bigint,
	       COUNT(*) FILTER (
	           WHERE stored_files.category IS NOT NULL AND stored_files.file_size IS NULL
	       )::bigint
	FROM categories
	LEFT JOIN stored_files ON stored_files.category = categories.category
	GROUP BY categories.category, categories.label, categories.sort_order
	ORDER BY categories.sort_order`

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
		(SELECT COUNT(*) FROM dndshare.logs),
		(SELECT COUNT(*) FROM dndshare.error_report)`,
	).Scan(&st.Users, &st.Characters, &st.Templates, &st.BaseItems, &st.UserItems, &st.BaseSuggests, &st.UserSuggests, &st.Logs, &st.ErrorReports)
	if err != nil {
		return AdminStats{}, err
	}

	rows, err := s.pool.Query(ctx, adminStorageStatsQuery)
	if err != nil {
		return AdminStats{}, err
	}
	defer rows.Close()
	st.Storage.Breakdown = make([]AdminStorageCategory, 0, 6)
	for rows.Next() {
		var category AdminStorageCategory
		if err := rows.Scan(&category.Key, &category.Label, &category.Bytes, &category.FileCount, &category.UnknownFileCount); err != nil {
			return AdminStats{}, err
		}
		st.Storage.UsedBytes += category.Bytes
		st.Storage.FileCount += category.FileCount
		st.Storage.UnknownFileCount += category.UnknownFileCount
		st.Storage.Breakdown = append(st.Storage.Breakdown, category)
	}
	if err := rows.Err(); err != nil {
		return AdminStats{}, err
	}
	return st, nil
}
