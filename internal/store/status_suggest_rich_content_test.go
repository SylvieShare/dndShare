package store

import (
	"strings"
	"testing"
)

func TestRewriteStatusSuggestHTMLUsesEffectItemReference(t *testing.T) {
	source := `<p>Цель становится <span data-rich-node="suggest" data-rich-payload="%7B%22id%22%3A5%2C%22typeId%22%3A9%7D" contenteditable="false">испуганной</span>.</p>`
	nodes := 0
	converted, changed, err := rewriteStatusSuggestHTML(source, map[int64]int64{5: 405}, &nodes)
	if err != nil {
		t.Fatal(err)
	}
	if !changed || nodes != 1 {
		t.Fatalf("status reference was not migrated: changed=%v nodes=%d html=%s", changed, nodes, converted)
	}
	if strings.Contains(converted, `data-rich-node="suggest"`) {
		t.Fatalf("legacy suggest reference remains: %s", converted)
	}
	payload := decodeMigratedPayload(t, converted, "item")
	if payload["id"] != float64(405) || payload["typeId"] != float64(15) {
		t.Fatalf("item payload = %#v", payload)
	}
}

func TestRewriteStatusSuggestHTMLPreservesOtherSuggestTypes(t *testing.T) {
	source := `<span data-rich-node="suggest" data-rich-payload="%7B%22id%22%3A10%2C%22typeId%22%3A15%7D" contenteditable="false">Внимание</span>`
	nodes := 0
	converted, changed, err := rewriteStatusSuggestHTML(source, map[int64]int64{10: 410}, &nodes)
	if err != nil {
		t.Fatal(err)
	}
	if changed || nodes != 0 || converted != source {
		t.Fatalf("unrelated suggest changed: changed=%v nodes=%d html=%s", changed, nodes, converted)
	}
}
