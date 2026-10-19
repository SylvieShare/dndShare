package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

type globalMapQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func globalMapReferences(ctx context.Context, q globalMapQuerier, sid int64) (map[int64]bool, map[int64]bool, map[int64]bool, error) {
	players, chapters, locations := map[int64]bool{}, map[int64]bool{}, map[int64]bool{}
	rows, err := q.Query(ctx, `SELECT char_id,0 FROM dndshare.session_participant WHERE session_id=$1 UNION ALL SELECT id,1 FROM dndshare.session_chapter WHERE session_id=$1 UNION ALL SELECT id,2 FROM dndshare.session_location WHERE session_id=$1`, sid)
	if err != nil {
		return nil, nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var kind int
		if err := rows.Scan(&id, &kind); err != nil {
			return nil, nil, nil, err
		}
		if kind == 1 {
			chapters[id] = true
		} else if kind == 2 {
			locations[id] = true
		} else {
			players[id] = true
		}
	}
	return players, chapters, locations, rows.Err()
}
