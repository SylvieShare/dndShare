package store

type rpsRound struct {
	Status          string
	SenderChoice    string
	RecipientChoice string
}

func validRPSDecision(decision string) bool {
	return decision == "accept" || decision == "decline" || decision == "cancel" || ValidRPSChoice(decision)
}

func advanceRPSRound(round rpsRound, sender bool, decision string) (rpsRound, error) {
	if !validRPSDecision(decision) {
		return round, ErrInvalidInteraction
	}
	if (sender && (decision == "accept" || decision == "decline")) || (!sender && decision == "cancel") {
		return round, ErrNotFound
	}
	if decision == "accept" {
		switch round.Status {
		case "pending":
			round.Status = "choosing"
			return round, nil
		case "choosing", "completed":
			return round, nil
		}
		return round, ErrInteractionConflict
	}
	if decision == "decline" || decision == "cancel" {
		wanted := "declined"
		if decision == "cancel" {
			wanted = "cancelled"
		}
		if round.Status == wanted {
			return round, nil
		}
		if round.Status != "pending" && round.Status != "choosing" {
			return round, ErrInteractionConflict
		}
		return rpsRound{Status: wanted}, nil
	}
	if round.Status != "choosing" && round.Status != "completed" {
		return round, ErrInteractionConflict
	}
	choice := &round.RecipientChoice
	if sender {
		choice = &round.SenderChoice
	}
	if *choice != "" {
		if *choice == decision {
			return round, nil
		}
		return round, ErrInteractionConflict
	}
	*choice = decision
	if round.SenderChoice != "" && round.RecipientChoice != "" {
		round.Status = "completed"
	}
	return round, nil
}
