package web

import (
	"errors"
	"maps"
	"strings"
	"testing"

	"dndshare/internal/battlemap"
)

// A reviewed import/cropping correction retains the original file and logical ID,
// but deliberately changes placement metadata, so existing maps cannot inherit it.
func preparedGeometryCorrectionError(model battlemap.Model, previous []battlemap.Model, reason string) error {
	if len(strings.TrimSpace(reason)) < 30 {
		return errors.New("geometry correction requires a concrete recorded reason")
	}
	var original *battlemap.Model
	for i := range previous {
		old := &previous[i]
		if old.ID == model.ID && old.Assets["source"] == model.Assets["source"] {
			original = old
			break
		}
	}
	if original == nil {
		return errors.New("geometry correction requires current source and stable UUID")
	}
	if model.DefinitionID == "" || model.DefinitionID != original.DefinitionID ||
		model.Code != original.Code || model.CollectionName != original.CollectionName || model.Hidden != original.Hidden {
		return errors.New("geometry correction must preserve logical identity, group, collection and visibility")
	}
	if preparedRevisionError(model, []battlemap.Model{*original}) == nil {
		return errors.New("compatible visuals must use ordinary revision comparison")
	}
	for _, kind := range []string{"render", "lod", "shadow"} {
		if model.Assets[kind].SHA256 == "" || model.Assets[kind].SHA256 == original.Assets[kind].SHA256 {
			return errors.New("geometry correction requires rebuilt render, LOD and shadow")
		}
	}
	return nil
}

func TestPreparedGeometryCorrectionRetainsOriginalAndDoesNotReplacePlacedVersion(t *testing.T) {
	old := battlemap.InitialCatalogue()[0]
	old.DefinitionID, old.Code = old.SourceCode, "LC-floor"
	revision := old
	revision.MaxHeight += .4
	revision.Assets = maps.Clone(old.Assets)
	for _, kind := range []string{"render", "lod", "shadow"} {
		asset := revision.Assets[kind]
		asset.SHA256 = strings.Repeat("a", 64)
		revision.Assets[kind] = asset
	}
	reason := "Restore the complete original sculpt after an incorrect universal mounting cut."
	if preparedRevisionError(revision, []battlemap.Model{old}) == nil {
		t.Fatal("incompatible crop correction passed ordinary visual validation")
	}
	if err := preparedGeometryCorrectionError(revision, []battlemap.Model{old}, reason); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*battlemap.Model){
		func(m *battlemap.Model) { m.ID = "different" },
		func(m *battlemap.Model) { m.DefinitionID = "OTHER-001" },
		func(m *battlemap.Model) { m.Code = "LC-other" },
		func(m *battlemap.Model) { m.MaxHeight = old.MaxHeight },
		func(m *battlemap.Model) {
			asset := m.Assets["source"]
			asset.SHA256 = strings.Repeat("b", 64)
			m.Assets["source"] = asset
		},
		func(m *battlemap.Model) { m.Assets["shadow"] = old.Assets["shadow"] },
	} {
		changed := revision
		changed.Assets = maps.Clone(revision.Assets)
		mutate(&changed)
		if preparedGeometryCorrectionError(changed, []battlemap.Model{old}, reason) == nil {
			t.Fatal("unsafe or undeclared correction passed")
		}
	}
	if preparedGeometryCorrectionError(revision, nil, reason) == nil ||
		preparedGeometryCorrectionError(revision, []battlemap.Model{old}, "fix") == nil {
		t.Fatal("correction passed without registry or reason")
	}
}
