package web

import "testing"

func TestValidSessionTimerSubtractAmount(t *testing.T) {
	tests := []struct {
		amount int64
		valid  bool
	}{
		{amount: 999, valid: false},
		{amount: 1_000, valid: true},
		{amount: 60_000, valid: true},
		{amount: 3_600_000, valid: true},
		{amount: 3_600_001, valid: false},
	}
	for _, test := range tests {
		if got := validSessionTimerSubtractAmount(test.amount); got != test.valid {
			t.Fatalf("validSessionTimerSubtractAmount(%d) = %v, want %v", test.amount, got, test.valid)
		}
	}
}
