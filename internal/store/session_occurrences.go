package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrOccurrenceNumber = errors.New("session occurrence number is already used")
var ErrOccurrenceConflict = errors.New("session occurrence has changed")
var ErrJournalSectionManaged = errors.New("session journal sections are managed by occurrences")

type SessionOccurrence struct {
	ID         int64     `json:"id"`
	Number     int       `json:"number"`
	Name       string    `json:"name"`
	Date       *string   `json:"date,omitempty"`
	SectionID  int64     `json:"sectionId"`
	EntryCount int       `json:"entryCount"`
	ChangedAt  time.Time `json:"changedAt"`
}

type SessionOccurrenceMutation struct {
	Number            int
	Name              string
	Date              string
	ExpectedChangedAt time.Time
}

func (s *Store) ListSessionOccurrences(ctx context.Context, sessionID int64) ([]SessionOccurrence, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT o.id, o.number, o.name, to_char(o.scheduled_on, 'YYYY-MM-DD'), js.id,
		       (SELECT count(*) FROM dndshare.journal_entry WHERE section_id = js.id), o.changed_at
		FROM dndshare.session_occurrence o
		JOIN dndshare.journal_section js ON js.occurrence_id = o.id
		WHERE o.session_id = $1 ORDER BY o.scheduled_on NULLS LAST, o.number, o.id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []SessionOccurrence{}
	for rows.Next() {
		var o SessionOccurrence
		if err := rows.Scan(&o.ID, &o.Number, &o.Name, &o.Date, &o.SectionID, &o.EntryCount, &o.ChangedAt); err != nil {
			return nil, err
		}
		result = append(result, o)
	}
	return result, rows.Err()
}

// Lock the campaign before its journal so all schedule mutations use the same order.
func lockOccurrenceJournal(ctx context.Context, tx pgx.Tx, sessionID int64) (int64, error) {
	var name string
	err := tx.QueryRow(ctx, `SELECT name FROM dndshare."session" WHERE id=$1 AND NOT deleted FOR UPDATE`, sessionID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.journal(session_id,name) VALUES($1,$2)
		ON CONFLICT(session_id) DO UPDATE SET changed_at=now() RETURNING id`, sessionID, journalOccurrenceName(name)).Scan(&id)
	return id, err
}

func journalOccurrenceName(name string) string {
	runes := []rune("Дневник · " + name)
	if len(runes) > 160 {
		runes = runes[:160]
	}
	return string(runes)
}

func occurrenceError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrOccurrenceNumber
	}
	return err
}

func (s *Store) CreateSessionOccurrence(ctx context.Context, sessionID int64, m SessionOccurrenceMutation) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	journalID, err := lockOccurrenceJournal(ctx, tx, sessionID)
	if err != nil {
		return 0, err
	}
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_occurrence(session_id,number,name,scheduled_on)
		VALUES($1,$2,$3,$4::date) RETURNING id`, sessionID, m.Number, m.Name, m.Date).Scan(&id)
	if err != nil {
		return 0, occurrenceError(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO dndshare.journal_section(journal_id,position,occurrence_id)
		VALUES($1,(SELECT COALESCE(max(position),0)+1 FROM dndshare.journal_section WHERE journal_id=$1),$2)`, journalID, id)
	if err != nil {
		return 0, err
	}
	return id, tx.Commit(ctx)
}

func (s *Store) UpdateSessionOccurrence(ctx context.Context, sessionID, id int64, m SessionOccurrenceMutation) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = lockOccurrenceJournal(ctx, tx, sessionID); err != nil {
		return err
	}
	var changedAt time.Time
	err = tx.QueryRow(ctx, `SELECT changed_at FROM dndshare.session_occurrence WHERE session_id=$1 AND id=$2`, sessionID, id).Scan(&changedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if !changedAt.Equal(m.ExpectedChangedAt) {
		return ErrOccurrenceConflict
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.session_occurrence SET number=$3,name=$4,scheduled_on=$5::date,changed_at=now()
		WHERE session_id=$1 AND id=$2`, sessionID, id, m.Number, m.Name, m.Date)
	if err != nil {
		return occurrenceError(err)
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteSessionOccurrence(ctx context.Context, sessionID, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	journalID, err := lockOccurrenceJournal(ctx, tx, sessionID)
	if err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `DELETE FROM dndshare.session_occurrence WHERE session_id=$1 AND id=$2`, sessionID, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	if _, err = tx.Exec(ctx, `UPDATE dndshare.journal SET graph_revision=graph_revision+1 WHERE id=$1`, journalID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
