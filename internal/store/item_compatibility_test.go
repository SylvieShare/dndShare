package store

import "testing"

func TestCompatibilityDecisions(t *testing.T) {
	id := int64(12)
	for _, rows := range [][]ItemCompatibility{
		{{SourceVersionID: 0, Status: "native"}},
		{{SourceVersionID: 1, Status: "native"}, {SourceVersionID: 1, Status: "compatible"}},
		{{SourceVersionID: 1, Status: "native", ReplacedByItemID: &id}},
		{{SourceVersionID: 1, Status: "unknown"}},
	} {
		if ValidateItemCompatibility(rows) == nil {
			t.Errorf("invalid decisions accepted: %+v", rows)
		}
	}
	for _, status := range []string{"legacy", "blocked", "requires_adaptation"} {
		if (ItemCompatibility{Status: status}).Selectable() {
			t.Errorf("%s selectable", status)
		}
	}
}
