package store

import (
	"errors"
	"testing"
)

func TestRPSInvitationAndIndependentChoices(t *testing.T) {
	round := rpsRound{Status: "pending"}
	for _, sender := range []bool{true, false} {
		if _, err := advanceRPSRound(round, sender, "rock"); !errors.Is(err, ErrInteractionConflict) {
			t.Fatalf("choice before acceptance: %v", err)
		}
	}
	var err error
	round, err = advanceRPSRound(round, false, "accept")
	if err != nil || round != (rpsRound{Status: "choosing"}) {
		t.Fatalf("accept: %+v %v", round, err)
	}
	round, err = advanceRPSRound(round, false, "paper")
	if err != nil || round.Status != "choosing" || round.SenderChoice != "" || round.RecipientChoice != "paper" {
		t.Fatalf("recipient may choose first: %+v %v", round, err)
	}
	if _, err := advanceRPSRound(round, false, "rock"); !errors.Is(err, ErrInteractionConflict) {
		t.Fatalf("a saved choice must not change: %v", err)
	}
	round, err = advanceRPSRound(round, true, "rock")
	if err != nil || round.Status != "completed" || rpsWinner(round.SenderChoice, round.RecipientChoice) != 2 {
		t.Fatalf("both choices complete the game: %+v %v", round, err)
	}
	for _, action := range []struct {
		sender   bool
		decision string
	}{{true, "rock"}, {false, "paper"}, {false, "accept"}} {
		retry, err := advanceRPSRound(round, action.sender, action.decision)
		if err != nil || retry != round {
			t.Fatalf("idempotent retry %+v: %+v %v", action, retry, err)
		}
	}
}

func TestRPSDismissalAndRoles(t *testing.T) {
	for _, round := range []rpsRound{{Status: "pending"}, {Status: "choosing", SenderChoice: "rock"}} {
		for _, decision := range []string{"accept", "decline"} {
			if _, err := advanceRPSRound(round, true, decision); !errors.Is(err, ErrNotFound) {
				t.Fatalf("sender must not %s: %v", decision, err)
			}
		}
		if _, err := advanceRPSRound(round, false, "cancel"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("recipient must not cancel: %v", err)
		}
		for _, action := range []struct {
			sender           bool
			decision, status string
		}{{true, "cancel", "cancelled"}, {false, "decline", "declined"}} {
			closed, err := advanceRPSRound(round, action.sender, action.decision)
			if err != nil || closed != (rpsRound{Status: action.status}) {
				t.Fatalf("dismiss must clear private choices: %+v %v", closed, err)
			}
			if _, err = advanceRPSRound(closed, false, "paper"); !errors.Is(err, ErrInteractionConflict) {
				t.Fatalf("closed round accepted a choice: %v", err)
			}
		}
	}
}
