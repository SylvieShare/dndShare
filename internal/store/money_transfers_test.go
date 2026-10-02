package store

import (
	"errors"
	"testing"
)

func TestMoveWalletMoney(t *testing.T) {
	sender, _ := decodeTransferDocument([]byte(`{"values":{"name":"Лиора","money":{"amounts":{"1":20,"2":9},"order":[2,1]}}}`))
	recipient, _ := decodeTransferDocument([]byte(`{"values":{"name":"Торин","hp":{"current":5}}}`))
	if err := moveWalletMoney(sender, recipient, 1, 20); err != nil {
		t.Fatal(err)
	}
	from, _ := walletAmounts(sender)
	to, _ := walletAmounts(recipient)
	if from["1"] != float64(0) || to["1"] != float64(20) || from["2"] != float64(9) {
		t.Fatalf("wallets: %v %v", from, to)
	}
	if sender.values()["money"].(map[string]any)["order"] == nil || recipient.values()["hp"] == nil {
		t.Fatal("transfer discarded wallet order or sheet fields")
	}
}

func TestMoveWalletMoneyRejectsInvalidBalances(t *testing.T) {
	for _, tc := range []struct {
		name, from, to string
		amount         int64
	}{
		{"overspend", `10`, `0`, 11},
		{"negative", `10`, `0`, -1},
		{"zero", `10`, `0`, 0},
		{"fractional", `1.5`, `0`, 1},
		{"negative balance", `-1`, `0`, 1},
		{"corrupt", `"broken"`, `0`, 1},
		{"overflow", `10`, `9007199254740991`, 1},
		{"unsafe integer", `9007199254740992`, `0`, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			from, _ := decodeTransferDocument([]byte(`{"values":{"money":{"amounts":{"1":` + tc.from + `}}}}`))
			to, _ := decodeTransferDocument([]byte(`{"values":{"money":{"amounts":{"1":` + tc.to + `}}}}`))
			before, _ := walletAmounts(from)
			original := before["1"]
			if err := moveWalletMoney(from, to, 1, tc.amount); !errors.Is(err, ErrMoneyTransfer) {
				t.Fatalf("expected rejection: %v", err)
			}
			if before["1"] != original {
				t.Fatal("rejected transfer changed sender balance")
			}
		})
	}
}
