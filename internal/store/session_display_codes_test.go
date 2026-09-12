package store

import "testing"

func TestNormalizeDisplayCode(t *testing.T) {
	for _, code := range []string{"ABC-123", "abc-123", "aB1-c2D", "000-999", "xyz-xyz"} {
		normalized, ok := NormalizeDisplayCode(code)
		if !ok || !displayCodePattern.MatchString(normalized) {
			t.Fatalf("rejected display code %q", code)
		}
		for _, char := range normalized {
			if char >= 'a' && char <= 'z' {
				t.Fatalf("code was not uppercased: %q", normalized)
			}
		}
	}
	for _, code := range []string{"", "ABC123", "AB-123", "ABCD-123", "АБВ-123", "abc_123", " abc-123", "abc-123\n", "１２３-abc", "11111111-1111-4111-8111-111111111111"} {
		if _, ok := NormalizeDisplayCode(code); ok {
			t.Fatalf("accepted invalid code %q", code)
		}
	}
}
