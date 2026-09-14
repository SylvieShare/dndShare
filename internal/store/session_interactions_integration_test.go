package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
)

// Runs in the disposable PostgreSQL fixture used by TestItemTransfersPostgres.
func testSessionInteractionsPostgres(t *testing.T, s *Store) {
	ctx := context.Background()
	_, err := s.pool.Exec(ctx, `INSERT INTO dndshare.users VALUES(4,'Uninvolved');
 INSERT INTO dndshare."char"(id,user_id,data) VALUES(4,4,'{"values":{"name":"Другой игрок"}}');
 INSERT INTO dndshare.session_participant VALUES(1,4,4)`)
	if err != nil {
		t.Fatal(err)
	}
	var sessionUUID, senderUUID, recipientUUID string
	if err = s.pool.QueryRow(ctx, `SELECT s.uuid::text,a.uuid::text,b.uuid::text FROM dndshare."session" s,dndshare."char" a,dndshare."char" b WHERE s.id=1 AND a.id=1 AND b.id=2`).Scan(&sessionUUID, &senderUUID, &recipientUUID); err != nil {
		t.Fatal(err)
	}
	key := 100
	create := func(kind, value string) SessionEvent {
		t.Helper()
		key++
		message, choice := "", ""
		if kind == "chat_message" {
			message = value
		} else {
			choice = value
		}
		e, err := s.CreateCharacterInteraction(ctx, 1, 1, 1, 2, kind, message, choice, fmt.Sprintf("00000000-0000-4000-8000-%012d", key))
		if err != nil {
			t.Fatal(err)
		}
		return e
	}
	decode := func(e SessionEvent) InteractionData {
		t.Helper()
		var d InteractionData
		if err := json.Unmarshal(e.Data, &d); err != nil {
			t.Fatal(err)
		}
		return d
	}
	message := create("chat_message", "Привет\n<script>hello</script>")
	if decode(message).Message != "Привет\n<script>hello</script>" {
		t.Fatal("message changed")
	}
	for _, args := range [][3]int64{{3, 1, 2}, {1, 1, 3}, {1, 1, 1}, {4, 1, 2}} {
		_, err := s.CreateCharacterInteraction(ctx, args[0], 1, args[1], args[2], "chat_message", "forged", "", "00000000-0000-4000-8000-000000001000")
		if !errors.Is(err, ErrNotFound) {
			t.Fatalf("unauthorized create %+v: %v", args, err)
		}
	}
	for _, reader := range []int64{1, 2, 3, 4} {
		page, err := s.GetSessionEvents(ctx, 1, reader, message.ID-1, 100)
		expected := 1
		if reader == 4 {
			expected = 0
		}
		if err != nil || len(page) != expected {
			t.Fatalf("audience %d: %+v %v", reader, page, err)
		}
	}
	pending, err := s.CharacterInteractions(ctx, 2, 2, sessionUUID, "", 0)
	if err != nil || len(pending) != 1 {
		t.Fatalf("unread: %+v %v", pending, err)
	}
	if err = s.ReadCharacterMessages(ctx, 4, 2, message.ID, sessionUUID, senderUUID); err != nil {
		t.Fatal(err)
	}
	pending, _ = s.CharacterInteractions(ctx, 2, 2, sessionUUID, "", 0)
	if len(pending) != 1 {
		t.Fatal("outsider marked read")
	}
	newer := create("chat_message", "Позднее сообщение")
	if err = s.ReadCharacterMessages(ctx, 2, 2, message.ID, sessionUUID, senderUUID); err != nil {
		t.Fatal(err)
	}
	pending, _ = s.CharacterInteractions(ctx, 2, 2, sessionUUID, "", 0)
	if len(pending) != 1 || pending[0].ID != newer.ID {
		t.Fatal("concurrent arrival was marked read")
	}

	round := create("rps_challenge", "rock")
	if strings.Contains(string(round.Data), "rock") || strings.Contains(string(round.Data), "senderChoice") {
		t.Fatal("POST leaked choice")
	}
	for _, reader := range []int64{1, 2, 3, 4} {
		page, err := s.GetSessionEvents(ctx, 1, reader, round.ID-1, 100)
		if err != nil {
			t.Fatal(err)
		}
		for _, e := range page {
			if strings.Contains(string(e.Data), "rock") {
				t.Fatal("GET leaked choice")
			}
		}
	}
	_, err = s.CreateCharacterInteraction(ctx, 2, 1, 2, 1, "rps_challenge", "", "paper", "00000000-0000-4000-8000-000000001001")
	if !errors.Is(err, ErrInteractionConflict) {
		t.Fatalf("reverse duplicate: %v", err)
	}
	retry, err := s.CreateCharacterInteraction(ctx, 1, 1, 1, 2, "rps_challenge", "", "rock", *round.ClientActionID)
	if err != nil || retry.ID != round.ID {
		t.Fatalf("idempotent create: %+v %v", retry, err)
	}
	for _, args := range []struct {
		user, char int64
		decision   string
	}{{1, 1, "paper"}, {3, 2, "paper"}, {4, 4, "paper"}, {2, 2, "cancel"}} {
		_, err := s.ResolveCharacterInteraction(ctx, args.user, args.char, round.ID, args.decision)
		if !errors.Is(err, ErrNotFound) {
			t.Fatalf("unauthorized resolve %+v: %v", args, err)
		}
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, choice := range []string{"paper", "scissors"} {
		wg.Add(1)
		go func(choice string) {
			defer wg.Done()
			_, err := s.ResolveCharacterInteraction(ctx, 2, 2, round.ID, choice)
			results <- err
		}(choice)
	}
	wg.Wait()
	close(results)
	successes, conflicts := 0, 0
	for err := range results {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrInteractionConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("concurrent answers: %d %d", successes, conflicts)
	}
	updates, err := s.SessionMutableEventUpdates(ctx, 1, 1, round.ID)
	if err != nil {
		t.Fatal(err)
	}
	var completed SessionEvent
	for _, e := range updates {
		if e.ID == round.ID {
			completed = e
		}
	}
	d := decode(completed)
	if d.Status != "completed" || d.SenderChoice != "rock" || !ValidRPSChoice(d.RecipientChoice) || d.ResolvedByUserID != 2 {
		t.Fatalf("result: %+v", d)
	}
	wantWinner := senderUUID
	if d.RecipientChoice == "paper" {
		wantWinner = recipientUUID
	}
	if d.WinnerCharUUID != wantWinner {
		t.Fatalf("winner: %+v", d)
	}
	retry, err = s.ResolveCharacterInteraction(ctx, 2, 2, round.ID, d.RecipientChoice)
	if err != nil || retry.ID != round.ID {
		t.Fatalf("retry response: %v", err)
	}
	for _, decision := range []string{"decline", "cancel"} {
		round = create("rps_challenge", "paper")
		user := int64(2)
		if decision == "cancel" {
			user = 1
		}
		event, err := s.ResolveCharacterInteraction(ctx, user, user, round.ID, decision)
		if err != nil || strings.Contains(string(event.Data), "Choice") {
			t.Fatalf("dismiss reveals choice: %+v %v", event, err)
		}
	}
	// Pagination remains stable; pending unread messages are not limited to one page.
	for i := 0; i < 55; i++ {
		create("chat_message", fmt.Sprintf("message %d", i))
	}
	history, err := s.CharacterInteractions(ctx, 2, 2, sessionUUID, senderUUID, 0)
	if err != nil || len(history) != 51 {
		t.Fatalf("history page: %d %v", len(history), err)
	}
	older, err := s.CharacterInteractions(ctx, 2, 2, sessionUUID, senderUUID, history[49].ID)
	if err != nil || len(older) == 0 || older[0].ID != history[50].ID {
		t.Fatalf("history cursor: %+v %v", older, err)
	}
	pending, _ = s.CharacterInteractions(ctx, 2, 2, sessionUUID, "", 0)
	if len(pending) != 56 {
		t.Fatalf("unread truncated: %d", len(pending))
	}
	outsider, _ := s.CharacterInteractions(ctx, 4, 2, sessionUUID, senderUUID, 0)
	if len(outsider) != 0 {
		t.Fatal("outsider reads conversation")
	}
	if _, err = s.pool.Exec(ctx, `UPDATE dndshare.session_participant SET session_id=2 WHERE char_id=2`); err != nil {
		t.Fatal(err)
	}
	removed, _ := s.CharacterInteractions(ctx, 2, 2, sessionUUID, senderUUID, 0)
	if len(removed) != 0 {
		t.Fatal("removed participant reads old session")
	}
	if _, err = s.pool.Exec(ctx, `UPDATE dndshare.session_participant SET session_id=1 WHERE char_id=2`); err != nil {
		t.Fatal(err)
	}
	// The remaining player can dismiss a round even when the opponent deletes a character.
	removedRound := create("rps_challenge", "rock")
	if _, err = s.pool.Exec(ctx, `UPDATE dndshare."char" SET deleted=true WHERE id=1`); err != nil {
		t.Fatal(err)
	}
	if _, err = s.ResolveCharacterInteraction(ctx, 2, 2, removedRound.ID, "decline"); err != nil {
		t.Fatalf("dismiss deleted peer: %v", err)
	}
	if _, err = s.pool.Exec(ctx, `UPDATE dndshare."char" SET deleted=false WHERE id=1`); err != nil {
		t.Fatal(err)
	}

}
