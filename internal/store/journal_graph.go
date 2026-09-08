package store

import (
	"context"
	"errors"
	"math"
	"strings"

	"github.com/jackc/pgx/v5"
)

var ErrJournalGraphConflict = errors.New("journal graph changed")
var ErrJournalGraphInvalid = errors.New("invalid journal graph")
var ErrJournalReadOnly = errors.New("journal is read only")

type JournalNode struct {
	ID        int64   `json:"id"`
	PositionX float64 `json:"positionX"`
	PositionY float64 `json:"positionY"`
}

type JournalLink struct {
	FromID int64  `json:"fromId"`
	ToID   int64  `json:"toId"`
	Label  string `json:"label"`
}

type JournalGraph struct {
	Revision int64         `json:"revision"`
	Nodes    []JournalNode `json:"nodes"`
	Links    []JournalLink `json:"links"`
}

type JournalGraphMutation struct {
	ExpectedRevision int64
	Links            []JournalLink
	Positions        []JournalNode
}

func loadJournalGraph(ctx context.Context, tx pgx.Tx, journalID int64) (JournalGraph, error) {
	graph := JournalGraph{Nodes: []JournalNode{}, Links: []JournalLink{}}
	if err := tx.QueryRow(ctx, `SELECT graph_revision FROM dndshare.journal WHERE id=$1`, journalID).Scan(&graph.Revision); err != nil {
		return graph, err
	}
	rows, err := tx.Query(ctx, `SELECT entry_id, position_x, position_y FROM dndshare.journal_node WHERE journal_id=$1 ORDER BY entry_id`, journalID)
	if err != nil {
		return graph, err
	}
	graph.Nodes, err = pgx.CollectRows(rows, pgx.RowToStructByPos[JournalNode])
	if err != nil {
		return graph, err
	}
	rows, err = tx.Query(ctx, `SELECT from_id, to_id, label FROM dndshare.journal_link WHERE journal_id=$1 ORDER BY from_id,to_id`, journalID)
	if err != nil {
		return graph, err
	}
	graph.Links, err = pgx.CollectRows(rows, pgx.RowToStructByPos[JournalLink])
	return graph, err
}

func lockJournalGraph(ctx context.Context, tx pgx.Tx, journalID int64, expected *int64) error {
	var revision int64
	err := tx.QueryRow(ctx, `SELECT graph_revision FROM dndshare.journal WHERE id=$1 FOR UPDATE`, journalID).Scan(&revision)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if expected != nil && revision != *expected {
		return ErrJournalGraphConflict
	}
	return nil
}

func validJournalPosition(node JournalNode) bool {
	return !math.IsNaN(node.PositionX) && !math.IsNaN(node.PositionY) &&
		math.Abs(node.PositionX) <= 1000000 && math.Abs(node.PositionY) <= 1000000
}

// Validate the entire proposed topology, including links outside the visible
// section. Kahn's algorithm permits any number of branches and merges, no cycles.
func validateJournalGraph(nodes []JournalNode, links []JournalLink) error {
	incoming := make(map[int64]int, len(nodes))
	outgoing := make(map[int64][]int64)
	seen := make(map[[2]int64]bool)
	for _, node := range nodes {
		incoming[node.ID] = 0
	}
	for _, link := range links {
		_, fromExists := incoming[link.FromID]
		_, toExists := incoming[link.ToID]
		key := [2]int64{link.FromID, link.ToID}
		if !fromExists || !toExists || link.FromID == link.ToID || seen[key] || len([]rune(link.Label)) > 240 {
			return ErrJournalGraphInvalid
		}
		seen[key] = true
		incoming[link.ToID]++
		outgoing[link.FromID] = append(outgoing[link.FromID], link.ToID)
	}
	queue := []int64{}
	for id, count := range incoming {
		if count == 0 {
			queue = append(queue, id)
		}
	}
	for i := 0; i < len(queue); i++ {
		for _, id := range outgoing[queue[i]] {
			incoming[id]--
			if incoming[id] == 0 {
				queue = append(queue, id)
			}
		}
	}
	if len(queue) != len(nodes) {
		return ErrJournalGraphInvalid
	}
	return nil
}

func (s *Store) UpdateJournalGraph(ctx context.Context, journalID, userID int64, mutation JournalGraphMutation) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = lockJournalGraph(ctx, tx, journalID, &mutation.ExpectedRevision); err != nil {
		return err
	}
	permissions, err := journalPermissions(ctx, tx, journalID, userID)
	if err != nil {
		return err
	}
	if !permissions.Edit {
		return ErrJournalReadOnly
	}
	graph, err := loadJournalGraph(ctx, tx, journalID)
	if err != nil {
		return err
	}
	ids := make(map[int64]bool, len(graph.Nodes))
	for _, node := range graph.Nodes {
		ids[node.ID] = true
	}
	seen := map[int64]bool{}
	for _, position := range mutation.Positions {
		if !ids[position.ID] || seen[position.ID] || !validJournalPosition(position) {
			return ErrJournalGraphInvalid
		}
		seen[position.ID] = true
	}
	if mutation.Links != nil {
		for i := range mutation.Links {
			mutation.Links[i].Label = strings.TrimSpace(mutation.Links[i].Label)
		}
		if err = validateJournalGraph(graph.Nodes, mutation.Links); err != nil {
			return err
		}
		previous := make(map[[2]int64]JournalLink, len(graph.Links))
		next := make(map[[2]int64]bool, len(mutation.Links))
		for _, link := range graph.Links {
			previous[[2]int64{link.FromID, link.ToID}] = link
		}
		for _, link := range mutation.Links {
			next[[2]int64{link.FromID, link.ToID}] = true
		}
		for key := range previous {
			if next[key] {
				continue
			}
			if _, err = tx.Exec(ctx, `DELETE FROM dndshare.journal_link WHERE journal_id=$1 AND from_id=$2 AND to_id=$3`, journalID, key[0], key[1]); err != nil {
				return err
			}
		}
		for _, link := range mutation.Links {
			if old, exists := previous[[2]int64{link.FromID, link.ToID}]; exists && old == link {
				continue
			}
			if _, err = tx.Exec(ctx, `INSERT INTO dndshare.journal_link(journal_id,from_id,to_id,label) VALUES($1,$2,$3,$4)
				ON CONFLICT (from_id,to_id) DO UPDATE SET label=EXCLUDED.label`, journalID, link.FromID, link.ToID, link.Label); err != nil {
				return err
			}
		}
	}
	for _, position := range mutation.Positions {
		if _, err = tx.Exec(ctx, `UPDATE dndshare.journal_node SET position_x=$3,position_y=$4 WHERE journal_id=$1 AND entry_id=$2
            AND (position_x IS DISTINCT FROM $3 OR position_y IS DISTINCT FROM $4)`, journalID, position.ID, position.PositionX, position.PositionY); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
