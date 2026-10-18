package main

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"testing"
)

func TestDocumentConversionPreservesOffAndVisualOverrides(t *testing.T) {
	raw := []byte(`{"version":2,"kind":"tiles","width":10,"height":10,"tiles":[],"objects":[],"flags":[{"id":"burning","enabled":false}],"lights":[{"id":"light","name":"Свет","kind":"torch","color":"#68cfff","x":2,"y":3,"elevation":0,"height":1,"intensity":8,"radius":4,"enabled":true,"flagId":"burning"}],"effects":[{"id":"fire","name":"Огонь","kind":"fire","color":"#ffb04a","size":[0.4,0.6],"strength":0.8,"enabled":true,"flagId":"burning","x":2.1,"y":3,"height":0.7}]}`)
	after, err := convertDocument(raw)
	if err != nil {
		t.Fatal(err)
	}
	var d battlemap.Document
	if err = json.Unmarshal(after, &d); err != nil {
		t.Fatal(err)
	}
	if len(d.Lights) != 1 || d.Lights[0].Enabled || d.Lights[0].Effect.Kind != "fire" || d.Lights[0].Color != "#68cfff" || d.Lights[0].Effect.Size[1] != .6 {
		t.Fatal(string(after))
	}
	if d.Lights[0].Effect.Offset[0] < .099 || d.Lights[0].Effect.Offset[2] > -.299 {
		t.Fatal("position lost", d.Lights[0])
	}
	var fields map[string]json.RawMessage
	json.Unmarshal(after, &fields)
	if fields["flags"] != nil || fields["effects"] != nil {
		t.Fatal("legacy entities remain")
	}
	again, err := convertDocument(after)
	if err != nil || string(again) != string(after) {
		t.Fatal("not idempotent", err)
	}
}

func TestIndependentFireBecomesZeroIntensityLight(t *testing.T) {
	raw := []byte(`{"version":2,"kind":"tiles","width":10,"height":10,"tiles":[],"objects":[],"lights":[],"effects":[{"id":"fire","name":"Огонь","kind":"fire","color":"#ffb04a","size":[0.4,0.6],"strength":0.8,"enabled":true,"x":2,"y":3,"height":0.7}]}`)
	after, err := convertDocument(raw)
	if err != nil {
		t.Fatal(err)
	}
	var d battlemap.Document
	json.Unmarshal(after, &d)
	if len(d.Lights) != 1 || d.Lights[0].Intensity != 0 || d.Lights[0].ID != "fire" || !d.Lights[0].Enabled {
		t.Fatal(string(after))
	}
}

func TestTemplateConversion(t *testing.T) {
	lights := []oldModelLight{{ModelLight: battlemap.ModelLight{Key: "lamp", Name: "Свет", Kind: "torch", Color: "#68cfff", Position: [3]float64{.5, .5, 1}, Intensity: 8, Radius: 4, Enabled: true}, FlagKey: "burning"}}
	effects := []oldEffect{{Key: "fire", Kind: "fire", Size: [2]float64{.2, .4}, Strength: .7, Position: [3]float64{.5, .5, .8}, Enabled: true, FlagKey: "burning"}}
	converted, err := convertTemplate(lights, []oldFlag{{Key: "burning", Enabled: false}}, effects)
	if err != nil {
		t.Fatal(err)
	}
	if converted[0].Enabled || converted[0].Effect.Kind != "fire" {
		t.Fatal("off default lost visual preset", converted)
	}
}
