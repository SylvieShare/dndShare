package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"testing"
)

func TestCatalogueSeparatesLogicalIdentityFromUUID(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	model.DefinitionID = "UD-010"
	model.Code = "UD-door"
	model.Name = "Door"
	data, err := json.Marshal(modelView(model, "/models"))
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err = json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	if fields["id"] != "UD-010" || fields["uuid"] != model.ID || fields["code"] != "UD-door" || fields["name"] != "Door" {
		t.Fatal("wrong catalogue identity", fields)
	}
	if _, legacy := fields["version"]; legacy {
		t.Fatal("model version leaked")
	}
	if _, legacy := fields["versionId"]; legacy {
		t.Fatal("version ID leaked")
	}
	if _, legacy := fields["definitionId"]; legacy {
		t.Fatal("logical ID alias leaked")
	}
}
