package battlemap

import "testing"

func componentFixture() (map[string]ModelMetadata, map[string]ModelBehaviour, string, string) {
	from, to := "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"
	m := InitialCatalogue()[0].ModelMetadata
	m.ID = from
	m.DefinitionID = "lit"
	m.TileType = "floor"
	m.Width = 1
	m.Height = 1
	m.SupportSlots = nil
	m.Blockers = nil
	m.WallMode = "none"
	m.WallMask = 0
	m.PlacementOffset = [2]float64{}
	m.MountDepth = .2
	m.SurfaceHeight = .4
	m.MaxHeight = 2
	n := m
	n.ID = to
	n.DefinitionID = "base"
	n.MaxHeight = 1.7
	light := ModelLight{Key: "flame", Name: "Свет", Kind: "torch", Color: "#ffb04a", Position: [3]float64{.3, .4, 1.5}, Intensity: 8, Radius: 4, Enabled: true}
	linked := light
	linked.FlagKey = "burning"
	return map[string]ModelMetadata{from: m, to: n}, map[string]ModelBehaviour{
		"lit":  {Revision: 1, DefaultLights: []ModelLight{light}},
		"base": {Revision: 1, DefaultFlags: []ModelFlag{{Key: "burning", Name: "Горит", Enabled: false}}, DefaultLights: []ModelLight{linked}, DefaultEffects: []ModelEffect{{Key: "fire", Name: "Пламя", Kind: "fire", Color: "#ffb04a", Size: [2]float64{.2, .35}, Strength: .7, Enabled: true, Position: [3]float64{.3, .4, 1.3}, FlagKey: "burning"}}},
	}, from, to
}

func TestMergeLitVariantPreservesIndependentStatesAndLightOverrides(t *testing.T) {
	models, behaviours, from, to := componentFixture()
	d := Document{Version: DocumentVersion, Kind: "tiles", Width: 10, Height: 10, Tiles: []Tile{{ID: "on", ModelID: from, X: 1, Y: 1}, {ID: "off", ModelID: from, X: 3, Y: 1}, {ID: "unlit", ModelID: to, X: 5, Y: 1}}}
	if err := SyncBuiltinLights(&d, models, behaviours); err != nil {
		t.Fatal(err)
	}
	intensity, yes := 17.0, true
	ids := map[string]string{}
	for i := range d.Lights {
		l := &d.Lights[i]
		ids[l.Anchor.ID] = l.ID
		if l.Anchor.ID == "off" {
			l.Enabled = false
		}
		if l.Anchor.ID == "on" {
			l.Overrides = &LightOverrides{Intensity: &intensity, Shadows: &yes}
		}
	}
	n, err := MergeLitVariant(&d, from, to, "burning", "flame", models, behaviours)
	if err != nil || n != 2 {
		t.Fatal(n, err)
	}
	states := map[string]bool{}
	for _, f := range d.Flags {
		states[f.Anchor.ID] = f.Enabled
	}
	if !states["on"] || states["off"] || states["unlit"] {
		t.Fatal("burning state changed", states)
	}
	if len(d.Effects) != 3 || len(d.Lights) != 3 {
		t.Fatal("missing components", d)
	}
	for _, l := range d.Lights {
		if !l.Enabled || l.FlagID == "" || l.ID != ids[l.Anchor.ID] {
			t.Fatal("identity or switch not transferred", l)
		}
		if l.Anchor.ID == "on" && (l.Intensity != 17 || !l.Shadows) {
			t.Fatal("lost overrides", l)
		}
	}
	for _, e := range d.Effects {
		if e.FlagID == "" || e.Anchor == nil {
			t.Fatal("effect not attached", e)
		}
	}
	for _, tile := range d.Tiles {
		if tile.ModelID != to {
			t.Fatal("unmerged placement", tile)
		}
	}
	if _, err = MergeLitVariant(&d, from, to, "burning", "flame", models, behaviours); err != nil {
		t.Fatal(err)
	}
	for _, f := range d.Flags {
		if f.Enabled != states[f.Anchor.ID] {
			t.Fatal("repeat changed state", f)
		}
	}
}

func TestFlagsAndEffectsValidationRejectsDanglingControlsAndForgedTemplates(t *testing.T) {
	models, behaviours, _, to := componentFixture()
	if err := ValidateModelBehaviour(behaviours["base"]); err != nil {
		t.Fatal(err)
	}
	d := Document{Version: DocumentVersion, Kind: "tiles", Width: 10, Height: 10, Tiles: []Tile{{ID: "torch", ModelID: to, X: 1, Y: 1}}}
	if err := SyncBuiltinLights(&d, models, behaviours); err != nil {
		t.Fatal(err)
	}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	d.Effects[0].FlagID = "missing"
	if ValidateDocument(&d) == nil {
		t.Fatal("dangling effect flag accepted")
	}
	d.Effects[0].FlagID = d.Flags[0].ID
	d.Lights[0].FlagID = "missing"
	if ValidateDocument(&d) == nil {
		t.Fatal("dangling light flag accepted")
	}
	d.Lights[0].FlagID = d.Flags[0].ID
	d.Flags[0].BuiltinKey = "forged"
	if SyncBuiltinLights(&d, models, behaviours) == nil {
		t.Fatal("forged built-in flag accepted")
	}
}
