package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"testing"
)

func TestCatalogueSeparatesLogicalIdentityFromVersion(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	model.DefinitionID = "UD-010"
	model.Code = "UD-door"
	model.Name = "Door"
	data, err := json.Marshal(modelView(model, model, "/models"))
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err = json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	if fields["id"] != "UD-010" || fields["versionId"] != model.ID || fields["code"] != "UD-door" || fields["name"] != "Door" {
		t.Fatal("wrong catalogue identity", fields)
	}
	if _, legacy := fields["definitionId"]; legacy {
		t.Fatal("logical ID alias leaked")
	}
}
