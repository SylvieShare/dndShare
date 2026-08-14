package web

import "testing"

func TestNormalizeParticipantColor(t *testing.T) {
	upper := "  #A1B2C3 "
	invalid := "red"

	tests := []struct {
		name  string
		input *string
		want  *string
		valid bool
	}{
		{name: "clear", input: nil, want: nil, valid: true},
		{name: "normalize", input: &upper, want: stringPtr("#a1b2c3"), valid: true},
		{name: "reject non hex", input: &invalid, want: nil, valid: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, valid := normalizeParticipantColor(tt.input)
			if valid != tt.valid {
				t.Fatalf("valid = %v, want %v", valid, tt.valid)
			}
			if tt.want == nil {
				if got != nil {
					t.Fatalf("color = %q, want nil", *got)
				}
				return
			}
			if got == nil || *got != *tt.want {
				t.Fatalf("color = %v, want %q", got, *tt.want)
			}
		})
	}
}

func stringPtr(value string) *string { return &value }
