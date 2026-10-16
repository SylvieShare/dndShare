package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

type globalMapQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func globalMapReferences(ctx context.Context, q globalMapQuerier, sid int64) (map[int64]bool, map[int64]bool, error) {
	players, chapters := map[int64]bool{}, map[int64]bool{}
	rows, err := q.Query(ctx, `SELECT char_id,false FROM dndshare.session_participant WHERE session_id=$1 UNION ALL SELECT id,true FROM dndshare.session_chapter WHERE session_id=$1`, sid)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var chapter bool
		if err := rows.Scan(&id, &chapter); err != nil {
			return nil, nil, err
		}
		if chapter {
			chapters[id] = true
		} else {
			players[id] = true
		}
	}
	return players, chapters, rows.Err()
}
