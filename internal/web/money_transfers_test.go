package web

import (
	"testing"

	"dndshare/internal/store"
)

func TestMoneyTransferRequest(t *testing.T) {
	version := int64(1)
	req := moneyTransferRequest{SessionUUID: "00000000-0000-4000-8000-000000000001", RecipientCharUUID: "00000000-0000-4000-8000-000000000002", ClientActionID: "00000000-0000-4000-8000-000000000003", CurrencyID: 1, Amount: 5, Version: &version}
	if !validMoneyTransferRequest(req) {
		t.Fatal("valid request rejected")
	}
	for _, mutate := range []func(*moneyTransferRequest){
		func(r *moneyTransferRequest) { r.SessionUUID = "invalid" },
		func(r *moneyTransferRequest) { r.RecipientCharUUID = "dm" },
		func(r *moneyTransferRequest) { r.ClientActionID = "" },
		func(r *moneyTransferRequest) { r.Version = nil },
		func(r *moneyTransferRequest) { r.CurrencyID = 0 },
		func(r *moneyTransferRequest) { r.Amount = 0 },
		func(r *moneyTransferRequest) { r.Amount = -1 },
		func(r *moneyTransferRequest) { r.Amount = store.MaxMoneyAmount + 1 },
	} {
		invalid := req
		mutate(&invalid)
		if validMoneyTransferRequest(invalid) {
			t.Fatalf("accepted invalid request: %+v", invalid)
		}
	}
	if allowedSessionEventTypes["money_transfer"] {
		t.Fatal("generic events can forge a money transfer")
	}
}
