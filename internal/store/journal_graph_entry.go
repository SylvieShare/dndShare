package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// Called inside the entry creation transaction. nil parents append to the sole
// terminal event; ambiguous histories start a separate root, never silently merge.
func attachJournalEntry(ctx context.Context, tx pgx.Tx, journalID, sectionID, entryID int64, mutation JournalEntryMutation) error {
	parents := mutation.ParentIDs
	if parents == nil {
		rows, err := tx.Query(ctx, `SELECT e.id FROM dndshare.journal_entry e
            WHERE e.section_id=$1 AND e.id<>$2 AND NOT EXISTS(SELECT 1 FROM dndshare.journal_link l WHERE l.from_id=e.id)
            ORDER BY e.position,e.id LIMIT 2`, sectionID, entryID)
		if err != nil {
			return err
		}
		parents, err = pgx.CollectRows(rows, pgx.RowTo[int64])
		if err != nil {
			return err
		}
		if len(parents) > 1 {
			parents = nil
		}
	}
	if len(parents) > 100 {
		return ErrJournalGraphInvalid
	}
	graph, err := loadJournalGraph(ctx, tx, journalID)
	if err != nil {
		return err
	}
	nodes := make(map[int64]JournalNode, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodes[node.ID] = node
	}
	position := JournalNode{ID: entryID}
	if len(parents) == 0 {
		if err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(n.position_x)+360,0) FROM dndshare.journal_node n
			JOIN dndshare.journal_entry e ON e.id=n.entry_id WHERE e.section_id=$1 AND e.id<>$2`, sectionID, entryID).Scan(&position.PositionX); err != nil {
			return err
		}
	}
	seen := map[int64]bool{}
	for index, parentID := range parents {
		parent, exists := nodes[parentID]
		if !exists || seen[parentID] || parentID == entryID {
			return ErrJournalGraphInvalid
		}
		seen[parentID] = true
		if index == 0 {
			position.PositionX = parent.PositionX
			position.PositionY = parent.PositionY - 200
		}
		if parent.PositionY-200 < position.PositionY {
			position.PositionY = parent.PositionY - 200
		}
		if _, err = tx.Exec(ctx, `INSERT INTO dndshare.journal_link(journal_id,from_id,to_id) VALUES($1,$2,$3)`, journalID, parentID, entryID); err != nil {
			return err
		}
	}
	// A second continuation is a branch in a neighbouring lane.
	if len(parents) == 1 {
		for _, link := range graph.Links {
			if link.FromID == parents[0] {
				position.PositionX += 360
			}
		}
	}
	if mutation.GraphPosition != nil {
		position = *mutation.GraphPosition
	}
	if !validJournalPosition(position) {
		return ErrJournalGraphInvalid
	}
	_, err = tx.Exec(ctx, `UPDATE dndshare.journal_node SET position_x=$3,position_y=$4 WHERE journal_id=$1 AND entry_id=$2`, journalID, entryID, position.PositionX, position.PositionY)
	return err
}
