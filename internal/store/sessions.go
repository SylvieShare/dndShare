package store

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// GameSession — строка dndshare.session (порт model/GameSession.kt).
type GameSession struct {
	ID               int64     `json:"id"`
	UUID             string    `json:"uuid"`
	OwnerUserID      int64     `json:"ownerUserId"`
	Name             string    `json:"name"`
	Description      *string   `json:"description,omitempty"`
	SystemID         *int64    `json:"systemId,omitempty"`
	SystemName       *string   `json:"systemName,omitempty"`
	InviteCode       string    `json:"inviteCode"`
	CurrentChapterID *int64    `json:"currentChapterId,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	ChangedAt        time.Time `json:"changedAt"`
}

// SessionParticipantData — участник сессии с данными персонажа (порт model/SessionParticipantData.kt).
type SessionParticipantData struct {
	CharID       int64          `json:"charId"`
	CharUUID     string         `json:"charUuid"`
	Version      int64          `json:"version"`
	TemplateID   int64          `json:"templateId"`
	TemplateName string         `json:"templateName"`
	Data         map[string]any `json:"data"`
	Role         string         `json:"role"`
	Color        *string        `json:"color,omitempty"`
}

// ParticipantBrief — краткая инфа об участнике для списка сессий.
type ParticipantBrief struct {
	CharUUID string  `json:"charUuid"`
	AvaURL   *string `json:"avaUrl,omitempty"`
}

// ChapterBrief — краткая инфа о текущей главе для списка сессий.
type ChapterBrief struct {
	Number      string  `json:"number"`
	Name        string  `json:"name"`
	ArcOrder    int     `json:"arcOrder"`
	ArcName     string  `json:"arcName"`
	ImageURL    string  `json:"imageUrl"`
	ImageFocalX float64 `json:"imageFocalX"`
	ImageFocalY float64 `json:"imageFocalY"`
}

// sessionSelect — общий SELECT сессии с именем системы (LEFT JOIN source).
const sessionSelect = `
	SELECT s.id, s.uuid::text, s.owner_user_id, s.name, s.description, s.system_id,
	       src.name AS source_name, s.invite_code, s.current_chapter_id,
	       s.created_at, s.changed_at
	FROM dndshare."session" s
	LEFT JOIN dndshare."source" src ON src.id = s.system_id`

func scanGameSession(row pgx.Row) (GameSession, error) {
	var g GameSession
	err := row.Scan(&g.ID, &g.UUID, &g.OwnerUserID, &g.Name, &g.Description, &g.SystemID,
		&g.SystemName, &g.InviteCode, &g.CurrentChapterID, &g.CreatedAt, &g.ChangedAt)
	return g, err
}

func (s *Store) queryGameSessions(ctx context.Context, sql string, args ...any) ([]GameSession, error) {
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []GameSession
	for rows.Next() {
		g, err := scanGameSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

// GetOwnerSessions — сессии, где пользователь мастер (порт getSessions).
func (s *Store) GetOwnerSessions(ctx context.Context, userID int64) ([]GameSession, error) {
	return s.queryGameSessions(ctx,
		sessionSelect+` WHERE s.owner_user_id = $1 AND s.deleted = false ORDER BY s.changed_at DESC`,
		userID,
	)
}

// GetPlayerSessions — сессии, где пользователь игрок, но не мастер (порт getPlayerSessions).
func (s *Store) GetPlayerSessions(ctx context.Context, userID int64) ([]GameSession, error) {
	return s.queryGameSessions(ctx,
		sessionSelect+`
		JOIN dndshare.session_participant sp ON sp.session_id = s.id
		WHERE sp.user_id = $1 AND s.owner_user_id != $1 AND s.deleted = false
		ORDER BY s.changed_at DESC`,
		userID,
	)
}

// GetGameSession — сессия по id (ErrNotFound, если нет).
func (s *Store) GetGameSession(ctx context.Context, id int64) (GameSession, error) {
	g, err := scanGameSession(s.pool.QueryRow(ctx,
		sessionSelect+` WHERE s.id = $1 AND s.deleted = false`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return GameSession{}, ErrNotFound
	}
	return g, err
}

// GetGameSessionByUUID — сессия по uuid (ErrNotFound, если нет).
func (s *Store) GetGameSessionByUUID(ctx context.Context, uuid string) (GameSession, error) {
	g, err := scanGameSession(s.pool.QueryRow(ctx,
		sessionSelect+` WHERE s.uuid = $1::uuid AND s.deleted = false`, uuid))
	if errors.Is(err, pgx.ErrNoRows) {
		return GameSession{}, ErrNotFound
	}
	return g, err
}

// GetGameSessionByInviteCode — сессия по инвайт-коду (ErrNotFound, если нет).
func (s *Store) GetGameSessionByInviteCode(ctx context.Context, code string) (GameSession, error) {
	g, err := scanGameSession(s.pool.QueryRow(ctx,
		sessionSelect+` WHERE s.invite_code = $1 AND s.deleted = false`, code))
	if errors.Is(err, pgx.ErrNoRows) {
		return GameSession{}, ErrNotFound
	}
	return g, err
}

// GetSessionParticipants — участники сессии с полными данными персонажей (порт getParticipants).
func (s *Store) GetSessionParticipants(ctx context.Context, sessionID int64) ([]SessionParticipantData, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT sp.char_id, sp.role, sp.color, c.uuid::text AS char_uuid, c.version, c.data AS char_data,
		        c.template_id, ct.name AS template_name
		 FROM dndshare.session_participant sp
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 JOIN dndshare.char_template ct ON ct.id = c.template_id
		 WHERE sp.session_id = $1
		 ORDER BY sp.sort_order, sp.id`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionParticipantData
	for rows.Next() {
		var p SessionParticipantData
		var charData []byte
		if err := rows.Scan(&p.CharID, &p.Role, &p.Color, &p.CharUUID, &p.Version, &charData, &p.TemplateID, &p.TemplateName); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(charData, &p.Data)
		out = append(out, p)
	}
	return out, rows.Err()
}

// SessionIDForCharacter returns the active session currently containing a
// character. The schema guarantees at most one such attachment.
func (s *Store) SessionIDForCharacter(ctx context.Context, charID int64) (int64, bool, error) {
	var sessionID int64
	err := s.pool.QueryRow(ctx, `
		SELECT participant.session_id
		FROM dndshare.session_participant participant
		JOIN dndshare."session" session ON session.id = participant.session_id
		WHERE participant.char_id = $1 AND session.deleted = false`, charID).Scan(&sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	return sessionID, err == nil, err
}

// GetSessionParticipantsBrief — краткая инфа об участниках для списка (порт getParticipantsBrief).
func (s *Store) GetSessionParticipantsBrief(ctx context.Context, sessionIDs []int64) (map[int64][]ParticipantBrief, error) {
	result := map[int64][]ParticipantBrief{}
	if len(sessionIDs) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT sp.session_id, c.uuid::text, c.data #>> '{values,ava,url}' AS avatar_url
		 FROM dndshare.session_participant sp
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 WHERE sp.session_id = ANY($1)
		 ORDER BY sp.session_id, sp.sort_order, sp.id`,
		sessionIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sid int64
		var charUUID string
		var avatarURL *string
		if err := rows.Scan(&sid, &charUUID, &avatarURL); err != nil {
			return nil, err
		}
		result[sid] = append(result[sid], ParticipantBrief{CharUUID: charUUID, AvaURL: avatarURL})
	}
	return result, rows.Err()
}

// GetMyCharUuids — карта sessionId -> uuid моего персонажа в этих сессиях (порт getMyCharUuids).
func (s *Store) GetMyCharUuids(ctx context.Context, sessionIDs []int64, userID int64) (map[int64]string, error) {
	result := map[int64]string{}
	if len(sessionIDs) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT sp.session_id, c.uuid::text
		 FROM dndshare.session_participant sp
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 WHERE sp.session_id = ANY($1) AND sp.user_id = $2`,
		sessionIDs, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sid int64
		var uuid string
		if err := rows.Scan(&sid, &uuid); err != nil {
			return nil, err
		}
		result[sid] = uuid
	}
	return result, rows.Err()
}

// GetCurrentChapters — карта sessionId -> текущая глава (порт getCurrentChapters).
func (s *Store) GetCurrentChapters(ctx context.Context, sessionIDs []int64) (map[int64]ChapterBrief, error) {
	result := map[int64]ChapterBrief{}
	if len(sessionIDs) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT s.id, ch.number, ch.name, arc."order", arc.name,
		        image.url, ch.image_focal_x, ch.image_focal_y
		 FROM dndshare."session" s
		 JOIN dndshare.session_chapter ch ON ch.id = s.current_chapter_id
		 JOIN dndshare.session_arc arc ON arc.id = ch.arc_id
		 JOIN dndshare.storage_image image ON image.id = ch.image_id AND image.deleted = false
		 WHERE s.id = ANY($1)`,
		sessionIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sid int64
		var cb ChapterBrief
		if err := rows.Scan(
			&sid, &cb.Number, &cb.Name, &cb.ArcOrder, &cb.ArcName,
			&cb.ImageURL, &cb.ImageFocalX, &cb.ImageFocalY,
		); err != nil {
			return nil, err
		}
		result[sid] = cb
	}
	return result, rows.Err()
}

// CreateSessionWithFirstArc создаёт сессию и её пустую первую арку одной транзакцией.
func (s *Store) CreateSessionWithFirstArc(ctx context.Context, userID int64, name string, description *string, systemID *int64) (int64, string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, "", err
	}
	defer tx.Rollback(ctx)

	var id int64
	var uuid string
	if err := tx.QueryRow(ctx,
		`INSERT INTO dndshare."session" (owner_user_id, name, description, system_id, invite_code)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id, uuid::text`,
		userID, name, description, systemID, generateInviteCode(),
	).Scan(&id, &uuid); err != nil {
		return 0, "", err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO dndshare.session_arc (session_id, "order", name) VALUES ($1, 1, $2)`,
		id, "Основная арка",
	); err != nil {
		return 0, "", err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO dndshare.session_presentation_state (session_id) VALUES ($1)`, id,
	); err != nil {
		return 0, "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, "", err
	}
	return id, uuid, nil
}

// UpdateSession меняет имя и описание сессии (порт updateSession).
func (s *Store) UpdateSession(ctx context.Context, uuid, name string, description *string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."session" SET name = $2, description = $3, changed_at = now()
		 WHERE uuid = $1::uuid AND deleted = false`,
		uuid, name, description,
	)
	return err
}

// DeleteGameSession помечает сессию удалённой (порт deleteSession).
func (s *Store) DeleteGameSession(ctx context.Context, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare."session" SET deleted = true WHERE id = $1`, id,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM dndshare.session_participant WHERE session_id = $1`, id,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// AddSessionParticipant attaches a character to one session. Replacing an
// existing attachment requires explicit confirmation from the caller.
func (s *Store) AddSessionParticipant(ctx context.Context, sessionID, charID, userID int64, replaceExisting bool) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var lockedSessionID int64
	if err := tx.QueryRow(ctx,
		`SELECT id FROM dndshare."session" WHERE id = $1 AND deleted = false FOR UPDATE`, sessionID,
	).Scan(&lockedSessionID); err != nil {
		return err
	}
	var lockedCharID int64
	if err := tx.QueryRow(ctx,
		`SELECT id FROM dndshare."char" WHERE id = $1 AND deleted = false FOR UPDATE`, charID,
	).Scan(&lockedCharID); err != nil {
		return err
	}
	var existingSessionID int64
	err = tx.QueryRow(ctx,
		`SELECT session_id FROM dndshare.session_participant WHERE char_id = $1`, charID,
	).Scan(&existingSessionID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if err == nil {
		if existingSessionID == sessionID {
			return tx.Commit(ctx)
		}
		if !replaceExisting {
			return ErrCharacterAlreadyInSession
		}
		if _, err := tx.Exec(ctx,
			`DELETE FROM dndshare.session_participant WHERE char_id = $1`, charID,
		); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO dndshare.session_participant (session_id, char_id, user_id, sort_order)
		 VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM dndshare.session_participant WHERE session_id = $1))`,
		sessionID, charID, userID,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RemoveSessionParticipant убирает участника по пользователю (порт removeParticipant).
func (s *Store) RemoveSessionParticipant(ctx context.Context, sessionID, userID int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.session_participant WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID,
	)
	return err
}

// RemoveSessionParticipantByCharID убирает участника по персонажу (порт removeParticipantByCharId).
func (s *Store) RemoveSessionParticipantByCharID(ctx context.Context, sessionID, charID int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.session_participant WHERE session_id = $1 AND char_id = $2`,
		sessionID, charID,
	)
	return err
}

// UpdateSessionParticipantColor assigns a session-local visual marker to a participant.
// It returns false when the character is no longer attached to the session.
func (s *Store) UpdateSessionParticipantColor(ctx context.Context, sessionID, charID int64, color *string) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_participant SET color = $3
		 WHERE session_id = $1 AND char_id = $2`,
		sessionID, charID, color,
	)
	return tag.RowsAffected() > 0, err
}

// ReorderSessionParticipants atomically rewrites the complete player order.
func (s *Store) ReorderSessionParticipants(ctx context.Context, sessionID int64, charIDs []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var lockedSessionID int64
	if err := tx.QueryRow(ctx,
		`SELECT id FROM dndshare."session" WHERE id = $1 FOR UPDATE`, sessionID,
	).Scan(&lockedSessionID); err != nil {
		return err
	}
	var matched, total, maxOrder int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM dndshare.session_participant WHERE session_id = $1 AND char_id = ANY($2)`,
		sessionID, charIDs,
	).Scan(&matched); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx,
		`SELECT count(*), COALESCE(MAX(sort_order), 0) FROM dndshare.session_participant WHERE session_id = $1`,
		sessionID,
	).Scan(&total, &maxOrder); err != nil {
		return err
	}
	if matched != len(charIDs) || total != len(charIDs) {
		return ErrNotFound
	}
	if _, err := tx.Exec(ctx,
		`UPDATE dndshare.session_participant SET sort_order = sort_order + $2
		 WHERE session_id = $1`, sessionID, maxOrder+1); err != nil {
		return err
	}
	for index, charID := range charIDs {
		if _, err := tx.Exec(ctx,
			`UPDATE dndshare.session_participant SET sort_order = $3
			 WHERE session_id = $1 AND char_id = $2`, sessionID, charID, index+1); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// GetEncounterData возвращает последний активный энкаунтер сессии как JSON-строку
// или nil, если его нет (порт SessionEncounterRepository.getEncounterData).
func (s *Store) GetEncounterData(ctx context.Context, sessionID int64) (*string, error) {
	var data *string
	err := s.pool.QueryRow(ctx,
		`SELECT data::text FROM dndshare.session_encounter
		 WHERE session_id = $1 AND deleted = false ORDER BY id DESC LIMIT 1`,
		sessionID,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return data, err
}

// SaveEncounterData обновляет последний активный энкаунтер или создаёт новый (порт saveEncounterData).
// Один statement под транзакцией, чтобы конкурентные сохранения не плодили дубли (у таблицы нет
// UNIQUE по session_id, поэтому используем UPDATE-затем-INSERT в tx с блокировкой строки).
func (s *Store) SaveEncounterData(ctx context.Context, sessionID int64, status string, round int, data string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var existing int64
	err = tx.QueryRow(ctx,
		`SELECT id FROM dndshare.session_encounter
		 WHERE session_id = $1 AND deleted = false ORDER BY id DESC LIMIT 1 FOR UPDATE`,
		sessionID,
	).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		if _, err = tx.Exec(ctx,
			`INSERT INTO dndshare.session_encounter (session_id, status, round, data)
			 VALUES ($1, $2, $3, CAST($4 AS jsonb))`,
			sessionID, status, round, data,
		); err != nil {
			return err
		}
	} else {
		if _, err = tx.Exec(ctx,
			`UPDATE dndshare.session_encounter SET status = $2, round = $3, data = CAST($4 AS jsonb), changed_at = now()
			 WHERE id = $1`,
			existing, status, round, data,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

type SessionMusicStateSnapshot struct {
	Data      string
	ChangedAt time.Time
}

func (s *Store) GetMusicStateSnapshot(ctx context.Context, sessionID int64) (*SessionMusicStateSnapshot, error) {
	var snapshot SessionMusicStateSnapshot
	err := s.pool.QueryRow(ctx,
		`SELECT data::text, changed_at FROM dndshare.session_music_state WHERE session_id = $1`,
		sessionID,
	).Scan(&snapshot.Data, &snapshot.ChangedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &snapshot, err
}

// SaveMusicStateData сохраняет состояние плеера (upsert по session_id, порт saveStateData).
// UNIQUE(session_id) позволяет сделать это одним атомарным INSERT ... ON CONFLICT без гонки.
func (s *Store) SaveMusicStateData(ctx context.Context, sessionID int64, data string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dndshare.session_music_state (session_id, data) VALUES ($1, CAST($2 AS jsonb))
		 ON CONFLICT (session_id) DO UPDATE SET data = EXCLUDED.data, changed_at = now()`,
		sessionID, data,
	)
	return err
}

// IsCharOwnedBy — принадлежит ли персонаж пользователю (порт CharacterRepository.isOwnedBy).
func (s *Store) IsCharOwnedBy(ctx context.Context, charID, userID int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare."char" WHERE id = $1 AND user_id = $2 AND deleted = false)`,
		charID, userID,
	).Scan(&exists)
	return exists, err
}

// GetMusicTrackFileKey возвращает storage metadata трека для выдачи playback URL.
// У системного трека ownerUserID равен 0. ErrNotFound, еси трека нет.
func (s *Store) GetMusicTrackFileKey(ctx context.Context, trackID int64) (fileKey string, ownerUserID int64, isSystem bool, err error) {
	err = s.pool.QueryRow(ctx,
		`SELECT file_key, COALESCE(owner_user_id, 0), is_system FROM dndshare.music_track WHERE id = $1`, trackID,
	).Scan(&fileKey, &ownerUserID, &isSystem)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, false, ErrNotFound
	}
	return fileKey, ownerUserID, isSystem, err
}

func generateInviteCode() string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	const digits = "0123456789"
	// crypto/rand: инвайт-код — единственный гейт на вход в сессию, он не должен быть предсказуемым.
	pick := func(alphabet string) byte {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return alphabet[0]
		}
		return alphabet[n.Int64()]
	}
	var b strings.Builder
	for i := 0; i < 5; i++ {
		b.WriteByte(pick(letters))
	}
	b.WriteByte('-')
	for i := 0; i < 5; i++ {
		b.WriteByte(pick(digits))
	}
	return b.String()
}
