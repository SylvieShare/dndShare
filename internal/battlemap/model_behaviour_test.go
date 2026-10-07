package battlemap

import "testing"

func TestBuiltinLightInstances(t *testing.T) {
	model := ModelMetadata{ID: "model", DefinitionID: "torch", Width: 1, Height: 1, MountDepth: .2, SurfaceHeight: .4}
	frame := ModelMetadata{ID: "frame", Width: 1, Height: 1, MountDepth: .1, SupportSlots: []SupportSlot{{Width: 1, Height: 1, Elevation: 1.1}}}
	b := map[string]ModelBehaviour{"torch": {DefaultLights: []ModelLight{{Key: "flame", Name: "Факел", Kind: "torch", Color: "#ffc36a", Position: [3]float64{.5, .75, 1.1}, Radius: 4.5, Intensity: 8, Enabled: true}}}}
	models := map[string]ModelMetadata{"model": model, "frame": frame}
	d := Document{Width: 10, Height: 10, Tiles: []Tile{{ID: "base", ModelID: "frame", X: 2, Y: 3}, {ID: "torch", ModelID: "model", X: 2, Y: 3, Level: 1, Rotation: 90}}}
	if err := SyncBuiltinLights(&d, models, b); err != nil {
		t.Fatal(err)
	}
	l := d.Lights[0]
	if l.X != 2.25 || l.Y != 3.5 || l.Elevation != 1 || l.Height != 1.1 || !l.Enabled || l.Shadows {
		t.Fatalf("bad pose: %+v", l)
	}
	d.Lights[0].Enabled = false
	d.Lights[0].Intensity = 50
	d.Lights[0].Shadows = true
	d.Tiles = append(d.Tiles, Tile{ID: "copy", ModelID: "model", X: 4, Y: 3})
	if err := SyncBuiltinLights(&d, models, b); err != nil {
		t.Fatal(err)
	}
	if d.Lights[0].ID != l.ID || d.Lights[0].Enabled || d.Lights[0].Intensity != 8 || d.Lights[0].Shadows || !d.Lights[1].Enabled || d.Lights[1].ID == l.ID {
		t.Fatal("lost independent instances", d.Lights)
	}
	d.Lights = append(d.Lights, Light{ID: "forged", BuiltinKey: "invented", Anchor: &LightAnchor{Kind: "tile", ID: "torch"}})
	if err := SyncBuiltinLights(&d, models, b); err == nil {
		t.Fatal("forged builtin bypassed validation")
	}
}

func TestModelBehaviourValidation(t *testing.T) {
	b := ModelBehaviour{Revision: 1, DefaultLights: []ModelLight{{Key: "lamp", Name: "Свет", Kind: "magic", Color: "#ffffff", Position: [3]float64{.5, .5, 1}, Radius: 4}}}
	if err := ValidateModelBehaviour(b); err != nil {
		t.Fatal(err)
	}
	b.DefaultLights = append(b.DefaultLights, b.DefaultLights[0])
	if ValidateModelBehaviour(b) == nil {
		t.Fatal("duplicate light key accepted")
	}
	b.DefaultLights = nil
	b.Transitions = []ModelTransition{{ID: "00000000-0000-4000-8000-000000000001", ToDefinitionID: "00000000-0000-4000-8000-000000000002", Action: "fill"}}
	if err := ValidateModelBehaviour(b); err != nil {
		t.Fatal(err)
	}
	b.Transitions = append(b.Transitions, b.Transitions[0])
	if ValidateModelBehaviour(b) == nil {
		t.Fatal("duplicate edge accepted")
	}
}
