package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type Journal struct {
	Graph          JournalGraph     `json:"graph"`
	PlayersCanEdit bool             `json:"playersCanEdit"`
	ID             int64            `json:"id"`
	UUID           string           `json:"uuid"`
	Name           string           `json:"name"`
	Kind           string           `json:"kind"`
	SessionUUID    *string          `json:"sessionUuid,omitempty"`
	SessionName    *string          `json:"sessionName,omitempty"`
	Sections       []JournalSection `json:"sections"`
	ChangedAt      time.Time        `json:"changedAt"`
}

type JournalSection struct {
	ID        int64          `json:"id"`
	Position  int            `json:"position"`
	Title     string         `json:"title"`
	Date      string         `json:"date"`
	Entries   []JournalEntry `json:"events"`
	ChangedAt time.Time      `json:"changedAt"`
}

type JournalEntry struct {
	ID                int64           `json:"id"`
	AuthorUserID      *int64          `json:"authorUserId,omitempty"`
	AuthorName        *string         `json:"authorName,omitempty"`
	CreatedAt         time.Time       `json:"createdAt"`
	ChangedByUserID   *int64          `json:"changedByUserId,omitempty"`
	ChangedByName     *string         `json:"changedByName,omitempty"`
	Position          int             `json:"position"`
	Type              string          `json:"type"`
	Title             string          `json:"title"`
	Description       string          `json:"desc"`
	Payload           json.RawMessage `json:"payload"`
	SourceSceneItemID *int64          `json:"sourceSceneItemId,omitempty"`
	SourceSnapshot    json.RawMessage `json:"sourceSnapshot,omitempty"`
	ChangedAt         time.Time       `json:"changedAt"`
}

type JournalSource struct {
	UUID        string  `json:"uuid"`
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	SessionUUID *string `json:"sessionUuid,omitempty"`
	SessionName *string `json:"sessionName,omitempty"`
}

type JournalEntryMutation struct {
	ExpectedGraphRevision *int64
	ParentIDs             []int64
	GraphPosition         *JournalNode
	ExpectedChangedAt     time.Time
	Type                  string
	Title                 string
	Description           string
	Payload               json.RawMessage
	SourceSceneItemID     *int64
	SourceSnapshot        json.RawMessage
}

const journalSelect = `
	SELECT journal.id, journal.uuid::text, journal.name,
	       CASE WHEN journal.session_id IS NULL THEN 'personal' ELSE 'session' END,
	       session.uuid::text, session.name, journal.changed_at, journal.players_can_edit
	FROM dndshare.journal journal
	LEFT JOIN dndshare."session" session ON session.id = journal.session_id`

func scanJournal(row pgx.Row) (Journal, error) {
	var journal Journal
	err := row.Scan(&journal.ID, &journal.UUID, &journal.Name, &journal.Kind,
		&journal.SessionUUID, &journal.SessionName, &journal.ChangedAt, &journal.PlayersCanEdit)
	if errors.Is(err, pgx.ErrNoRows) {
		return Journal{}, ErrNotFound
	}
	return journal, err
}

func (s *Store) GetJournalByUUID(ctx context.Context, uuid string) (Journal, error) {
	journal, err := scanJournal(s.pool.QueryRow(ctx, journalSelect+` WHERE journal.uuid = $1::uuid`, uuid))
	if err != nil {
		return Journal{}, err
	}
	return s.loadJournalSections(ctx, journal)
}

func (s *Store) GetCharacterJournal(ctx context.Context, charID int64) (*Journal, error) {
	journal, err := scanJournal(s.pool.QueryRow(ctx, journalSelect+`
		JOIN dndshare.character_journal link ON link.journal_id = journal.id
		WHERE link.char_id = $1`, charID))
	if errors.Is(err, ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	loaded, err := s.loadJournalSections(ctx, journal)
	return &loaded, err
}

func (s *Store) GetSessionJournal(ctx context.Context, sessionID int64) (*Journal, error) {
	journal, err := scanJournal(s.pool.QueryRow(ctx, journalSelect+` WHERE journal.session_id = $1`, sessionID))
	if errors.Is(err, ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	loaded, err := s.loadJournalSections(ctx, journal)
	return &loaded, err
}

func (s *Store) UserCanAccessJournal(ctx context.Context, journalID, userID int64) (bool, error) {
	p, err := s.JournalPermissions(ctx, journalID, userID)
	return p.Read, err
}

func (s *Store) ListJournalSourcesForCharacter(ctx context.Context, charID, userID int64) ([]JournalSource, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT journal.uuid::text, journal.name,
		       CASE WHEN journal.session_id IS NULL THEN 'personal' ELSE 'session' END,
		       session.uuid::text, session.name
		FROM dndshare.journal journal
		LEFT JOIN dndshare."session" session ON session.id = journal.session_id
		WHERE (journal.personal_char_id = $1 AND journal.owner_user_id = $2)
		   OR (session.deleted = false AND journal.session_id IN (
			SELECT participant.session_id FROM dndshare.session_participant participant
			WHERE participant.char_id = $1 AND participant.user_id = $2
		   ))
		ORDER BY journal.session_id NULLS FIRST, journal.changed_at DESC`, charID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sources := []JournalSource{}
	for rows.Next() {
		var source JournalSource
		if err := rows.Scan(&source.UUID, &source.Name, &source.Kind, &source.SessionUUID, &source.SessionName); err != nil {
			return nil, err
		}
		sources = append(sources, source)
	}
	return sources, rows.Err()
}

func (s *Store) CreatePersonalJournal(ctx context.Context, charID, userID int64, name string) (Journal, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Journal{}, err
	}
	defer tx.Rollback(ctx)
	journal, err := scanJournal(tx.QueryRow(ctx, `
		INSERT INTO dndshare.journal (personal_char_id, owner_user_id, name) VALUES ($1, $2, $3)
		ON CONFLICT (personal_char_id) DO UPDATE SET name = dndshare.journal.name
		WHERE dndshare.journal.owner_user_id = EXCLUDED.owner_user_id
		RETURNING id, uuid::text, name, 'personal', NULL::text, NULL::text, changed_at, players_can_edit`, charID, userID, name))
	if err != nil {
		return Journal{}, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO dndshare.character_journal (char_id, journal_id) VALUES ($1, $2)
		ON CONFLICT (char_id) DO UPDATE SET journal_id = EXCLUDED.journal_id, linked_at = now()`, charID, journal.ID); err != nil {
		return Journal{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Journal{}, err
	}
	return s.loadJournalSections(ctx, journal)
}

func (s *Store) CreateSessionJournal(ctx context.Context, sessionID int64, name string) (Journal, error) {
	journal, err := scanJournal(s.pool.QueryRow(ctx, `
		INSERT INTO dndshare.journal (session_id, name) VALUES ($1, $2)
		ON CONFLICT (session_id) DO UPDATE SET name = dndshare.journal.name
		RETURNING id, uuid::text, name, 'session',
		  (SELECT uuid::text FROM dndshare."session" WHERE id = $1),
		  (SELECT name FROM dndshare."session" WHERE id = $1), changed_at, players_can_edit`, sessionID, name))
	if err != nil {
		return Journal{}, err
	}
	return s.loadJournalSections(ctx, journal)
}

func (s *Store) LinkCharacterJournal(ctx context.Context, charID, journalID int64) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO dndshare.character_journal (char_id, journal_id) VALUES ($1, $2)
		ON CONFLICT (char_id) DO UPDATE SET journal_id = EXCLUDED.journal_id, linked_at = now()`, charID, journalID)
	return err
}

func (s *Store) CreateJournalSection(ctx context.Context, journalID int64, title, date string) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var lockedID int64
	if err := tx.QueryRow(ctx, `SELECT id FROM dndshare.journal WHERE id = $1 FOR UPDATE`, journalID).Scan(&lockedID); errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	} else if err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.journal_section (journal_id, position, title, event_date)
		VALUES ($1, (SELECT COALESCE(MAX(position), 0) + 1 FROM dndshare.journal_section WHERE journal_id = $1), $2, $3)
		RETURNING id`, journalID, title, date).Scan(&id)
	if err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.journal SET changed_at = now() WHERE id = $1`, journalID); err != nil {
		return 0, err
	}
	return id, tx.Commit(ctx)
}

func (s *Store) UpdateJournalSection(ctx context.Context, journalID, sectionID int64, title, date string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return err
	}
	command, err := tx.Exec(ctx, `
		WITH changed AS (
			UPDATE dndshare.journal_section SET title = $3, event_date = $4, changed_at = now()
			WHERE id = $2 AND journal_id = $1 RETURNING journal_id
		)
		UPDATE dndshare.journal SET changed_at = now()
		FROM changed WHERE dndshare.journal.id = changed.journal_id`, journalID, sectionID, title, date)
	if err == nil && command.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteJournalSection(ctx context.Context, journalID, sectionID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return err
	}
	command, err := tx.Exec(ctx, `
		WITH changed AS (
			DELETE FROM dndshare.journal_section WHERE id = $2 AND journal_id = $1 RETURNING journal_id
		)
		UPDATE dndshare.journal SET changed_at = now()
		FROM changed WHERE dndshare.journal.id = changed.journal_id`, journalID, sectionID)
	if err == nil && command.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) CreateJournalEntry(ctx context.Context, journalID, sectionID, userID int64, mutation JournalEntryMutation) (int64, error) {
	payload := mutation.Payload
	if len(payload) == 0 {
		payload = json.RawMessage("{}")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, mutation.ExpectedGraphRevision); err != nil {
		return 0, err
	}
	var lockedID int64
	if err := tx.QueryRow(ctx, `
		SELECT id FROM dndshare.journal_section WHERE id = $2 AND journal_id = $1 FOR UPDATE`, journalID, sectionID).Scan(&lockedID); errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	} else if err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.journal_entry (
			section_id, author_user_id, changed_by_user_id, position, entry_type, title, description_html,
			payload, source_scene_item_id, source_snapshot
		)
		VALUES ($1, $2, $2,
		       COALESCE((SELECT MAX(position) FROM dndshare.journal_entry WHERE section_id = $1), 0) + 1,
		       $3, $4, $5, CAST($6 AS jsonb), $7, CAST($8 AS jsonb))
		RETURNING id`, sectionID, userID, mutation.Type, mutation.Title, mutation.Description,
		string(payload), mutation.SourceSceneItemID, nullableJSON(mutation.SourceSnapshot)).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	if err = attachJournalEntry(ctx, tx, journalID, sectionID, id, mutation); err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.journal SET changed_at = now() WHERE id = $1`, journalID); err != nil {
		return 0, err
	}
	return id, tx.Commit(ctx)
}

func nullableJSON(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return string(raw)
}

func (s *Store) UpdateJournalEntry(ctx context.Context, journalID, entryID, userID int64, mutation JournalEntryMutation) error {
	payload := mutation.Payload
	if len(payload) == 0 {
		payload = json.RawMessage("{}")
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return err
	}
	command, err := tx.Exec(ctx, `
		WITH changed AS (
			UPDATE dndshare.journal_entry entry
			SET title = $4, description_html = $5, payload = CAST($6 AS jsonb), changed_at = now(), changed_by_user_id = $7
			FROM dndshare.journal_section section
			WHERE entry.id = $2 AND entry.section_id = section.id AND section.journal_id = $1 AND entry.entry_type = $3
			  AND entry.changed_at = $8
			RETURNING section.journal_id
		)
		UPDATE dndshare.journal SET changed_at = now()
		FROM changed WHERE dndshare.journal.id = changed.journal_id`,
		journalID, entryID, mutation.Type, mutation.Title, mutation.Description, string(payload), userID, mutation.ExpectedChangedAt)
	if err == nil && command.RowsAffected() == 0 {
		return ErrJournalEntryConflict
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteJournalEntry(ctx context.Context, journalID, entryID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, nil); err != nil {
		return err
	}
	command, err := tx.Exec(ctx, `
		WITH changed AS (
			DELETE FROM dndshare.journal_entry entry USING dndshare.journal_section section
			WHERE entry.id = $2 AND entry.section_id = section.id AND section.journal_id = $1
			RETURNING section.journal_id
		)
		UPDATE dndshare.journal SET changed_at = now()
		FROM changed WHERE dndshare.journal.id = changed.journal_id`, journalID, entryID)
	if err == nil && command.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
