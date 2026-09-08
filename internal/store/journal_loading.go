package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

func (s *Store) loadJournalSections(ctx context.Context, journal Journal) (Journal, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return Journal{}, err
	}
	defer tx.Rollback(ctx)
	journal.Graph, err = loadJournalGraph(ctx, tx, journal.ID)
	if err != nil {
		return Journal{}, err
	}
	rows, err := tx.Query(ctx, `
		SELECT id, position, title, event_date, changed_at
		FROM dndshare.journal_section WHERE journal_id = $1 ORDER BY position, id`, journal.ID)
	if err != nil {
		return Journal{}, err
	}
	defer rows.Close()
	journal.Sections = []JournalSection{}
	sectionByID := map[int64]int{}
	for rows.Next() {
		var section JournalSection
		if err := rows.Scan(&section.ID, &section.Position, &section.Title, &section.Date, &section.ChangedAt); err != nil {
			return Journal{}, err
		}
		section.Entries = []JournalEntry{}
		sectionByID[section.ID] = len(journal.Sections)
		journal.Sections = append(journal.Sections, section)
	}
	if err := rows.Err(); err != nil || len(journal.Sections) == 0 {
		return journal, err
	}
	ids := make([]int64, 0, len(journal.Sections))
	for _, section := range journal.Sections {
		ids = append(ids, section.ID)
	}
	entryRows, err := tx.Query(ctx, `
		SELECT e.section_id, e.id, e.author_user_id, e.position, e.entry_type, e.title,
		       e.description_html, e.payload, e.source_scene_item_id, e.source_snapshot, e.changed_at,
		       e.created_at, author.login, e.changed_by_user_id, editor.login
		FROM dndshare.journal_entry e
		LEFT JOIN dndshare.users author ON author.id = e.author_user_id
		LEFT JOIN dndshare.users editor ON editor.id = e.changed_by_user_id
		WHERE e.section_id = ANY($1)
		ORDER BY e.section_id, e.position, e.id`, ids)
	if err != nil {
		return Journal{}, err
	}
	defer entryRows.Close()
	for entryRows.Next() {
		var sectionID int64
		var entry JournalEntry
		var payload, snapshot []byte
		if err := entryRows.Scan(&sectionID, &entry.ID, &entry.AuthorUserID, &entry.Position,
			&entry.Type, &entry.Title, &entry.Description, &payload, &entry.SourceSceneItemID,
			&snapshot, &entry.ChangedAt, &entry.CreatedAt, &entry.AuthorName,
			&entry.ChangedByUserID, &entry.ChangedByName); err != nil {
			return Journal{}, err
		}
		entry.Payload = json.RawMessage(payload)
		if len(snapshot) > 0 {
			entry.SourceSnapshot = json.RawMessage(snapshot)
		}
		index, ok := sectionByID[sectionID]
		if ok {
			journal.Sections[index].Entries = append(journal.Sections[index].Entries, entry)
		}
	}
	return journal, entryRows.Err()
}
