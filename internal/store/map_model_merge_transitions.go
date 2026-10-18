package store

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func mergeModelTransitions(ctx context.Context, tx pgx.Tx, from, to string, apply bool) error {
	rows, err := tx.Query(ctx, `SELECT id::text,from_model_id,to_model_id,action FROM dndshare.map_model_transition WHERE from_model_id=$1 OR to_model_id=$1 FOR UPDATE`, from)
	if err != nil {
		return err
	}
	type transition struct{ id, from, to, action string }
	edges := []transition{}
	for rows.Next() {
		var t transition
		if err = rows.Scan(&t.id, &t.from, &t.to, &t.action); err != nil {
			rows.Close()
			return err
		}
		edges = append(edges, t)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, t := range edges {
		if (t.from == from && t.to == to || t.from == to && t.to == from) && t.action != "ignite" && t.action != "extinguish" {
			return fmt.Errorf("%w: Переход между вариантами требует отдельного переноса", ErrInvalidMapModels)
		}
	}
	if !apply {
		return nil
	}
	if _, err = tx.Exec(ctx, `DELETE FROM dndshare.map_model_transition WHERE from_model_id=$1 OR to_model_id=$1`, from); err != nil {
		return err
	}
	affected := map[string]bool{}
	for _, t := range edges {
		affected[t.from] = true
		if t.from == from {
			t.from = to
		}
		if t.to == from {
			t.to = to
		}
		affected[t.from] = true
		if t.from == t.to {
			continue
		}
		if _, err = tx.Exec(ctx, `INSERT INTO dndshare.map_model_transition(id,from_model_id,to_model_id,action) VALUES($1::uuid,$2,$3,$4) ON CONFLICT(from_model_id,to_model_id,action) DO NOTHING`, t.id, t.from, t.to, t.action); err != nil {
			return err
		}
	}
	for id := range affected {
		if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model_definition SET revision=revision+1 WHERE id=$1`, id); err != nil {
			return err
		}
	}
	return nil
}
