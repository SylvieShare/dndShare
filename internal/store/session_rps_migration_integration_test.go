package store

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func testRPSInvitationMigration(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO dndshare.session_event(id,session_id,author_user_id,event_type,data)
 VALUES(900001,1,1,'rps_challenge','{"status":"pending","senderName":"Лиора","senderChoice":"rock"}'),
 (900002,1,1,'rps_challenge','{"status":"completed","senderChoice":"scissors","recipientChoice":"scissors"}');
 INSERT INTO dndshare.session_interaction(event_id,session_id,sender_char_id,recipient_char_id,kind,status,sender_choice,recipient_choice)
 VALUES(900001,1,1,2,'rps_challenge','pending','rock',NULL),
 (900002,1,1,2,'rps_challenge','completed','scissors','scissors');`)
	exec(schemaRPSInvitationsSQL)
	var choice *string
	var encoded json.RawMessage
	if err := pool.QueryRow(ctx, `SELECT i.sender_choice,e.data FROM dndshare.session_interaction i JOIN dndshare.session_event e ON e.id=i.event_id WHERE i.event_id=900001`).Scan(&choice, &encoded); err != nil {
		t.Fatal(err)
	}
	var data InteractionData
	if err := json.Unmarshal(encoded, &data); err != nil || choice != nil || data.Status != "pending" || data.SenderChoice != "" || data.SenderName != "Лиора" {
		t.Fatalf("old unfinished round must become an invitation: %+v %v", data, err)
	}
	if err := pool.QueryRow(ctx, `SELECT data FROM dndshare.session_event WHERE id=900002`).Scan(&encoded); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(encoded, &data); err != nil || data.Status != "completed" || data.SenderChoice != "scissors" || data.RecipientChoice != "scissors" || !data.SenderReady || !data.RecipientReady {
		t.Fatalf("completed history must be preserved: %+v %v", data, err)
	}
	for _, sql := range []string{
		`UPDATE dndshare.session_interaction SET sender_choice='rock' WHERE event_id=900001`,
		`UPDATE dndshare.session_interaction SET status='choosing',sender_choice='rock',recipient_choice='paper' WHERE event_id=900001`,
		`UPDATE dndshare.session_interaction SET recipient_choice=NULL WHERE event_id=900002`,
	} {
		_, err := pool.Exec(ctx, sql)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "23514" {
			t.Fatalf("invalid round must violate a check: %v", err)
		}
	}
	exec(`UPDATE dndshare.session_interaction SET status='choosing' WHERE event_id=900001`)
	_, err := pool.Exec(ctx, `UPDATE dndshare.session_interaction SET status='choosing',sender_choice=NULL WHERE event_id=900002`)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		t.Fatalf("one accepted round per pair: %v", err)
	}
	exec(`DELETE FROM dndshare.session_interaction WHERE event_id IN (900001,900002);
 DELETE FROM dndshare.session_event WHERE id IN (900001,900002)`)
}
