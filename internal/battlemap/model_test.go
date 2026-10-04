package battlemap

import "testing"

func TestPresetsAreValidIndependentDocuments(t *testing.T) {
	for _, p := range Presets() {
		t.Run(p.ID, func(t *testing.T) {
			if err := ValidateDocument(&p.Document); err != nil {
				t.Fatal(err)
			}
			state := InitialState()
			if err := ValidateState(&state, p.Document); err != nil {
				t.Fatal(err)
			}
		})
	}
	a, b := Presets(), Presets()
	a[0].Document.Tiles[0].Rotation = 90
	if b[0].Document.Tiles[0].Rotation == 90 {
		t.Fatal("presets share mutable state")
	}
}

func TestVisibilityAndPublicProjection(t *testing.T) {
	d := Presets()[0].Document
	d.Zones = []Zone{{ID: "room", Name: "Secret", Rects: []Rect{{0, 0, 8, 8}}}, {ID: "window", Rects: []Rect{{3, 3, 2, 2}}}}
	s := InitialState()
	s.Zones["room"] = "explored"
	s.Zones["window"] = "visible"
	for _, test := range []struct {
		x, y float64
		want string
	}{{1, 1, "explored"}, {3.5, 3.5, "visible"}, {8, 8, "hidden"}} {
		if got := Visibility(d, s, test.x, test.y); got != test.want {
			t.Fatalf("%+v got %s", test, got)
		}
	}
	s.Tokens = []Token{{ID: "known", X: 4, Y: 4, Ref: "private-id"}, {ID: "physical", X: 4, Y: 4, Physical: true}, {ID: "secret", X: 4, Y: 4, Hidden: true}, {ID: "in-fog", X: 10, Y: 10}, {ID: "explored", X: 1, Y: 1}}
	public := PublicState(d, s)
	if len(public.Tokens) != 1 || public.Tokens[0].ID != "known" || public.Tokens[0].Ref != "" {
		t.Fatalf("leaked token: %+v", public.Tokens)
	}
	if len(s.Tokens) != 5 || s.Tokens[0].Ref != "private-id" {
		t.Fatal("projection mutated private state")
	}
	s.Fog = false
	if Visibility(d, s, 100, 100) != "visible" {
		t.Fatal("disabled fog")
	}
}

func TestInvalidDocumentsAndState(t *testing.T) {
	for _, change := range []func(*Document){
		func(d *Document) { d.Width = 100000 }, func(d *Document) { d.Tiles[0].X = -1 },
		func(d *Document) { d.Tiles[0].ModelID = "unknown" }, func(d *Document) { d.Kind = "image"; d.Background.URL = "javascript:bad" },
		func(d *Document) { d.Zones = []Zone{{ID: "room", Rects: []Rect{{29, 21, 5, 5}}}} },
		func(d *Document) { d.Tiles = append(d.Tiles, d.Tiles[0]) },
		func(d *Document) { d.Version = 1 },
	} {
		d := Presets()[0].Document
		change(&d)
		if ValidateDocument(&d) == nil {
			t.Fatal("accepted invalid document")
		}
	}
	d := Presets()[0].Document
	s := InitialState()
	s.Objects["nonexistent"] = true
	if ValidateState(&s, d) == nil {
		t.Fatal("accepted unknown interactive object")
	}
	for _, url := range []string{"javascript:alert(1)", "//evil.test/a", "/\\evil.test/a", "https://user:pass@host/a"} {
		if SafeURL(url) {
			t.Fatalf("unsafe URL %s", url)
		}
	}
}

func TestOffsetGridDoesNotWrapZoneCells(t *testing.T) {
	d := Presets()[0].Document
	d.Grid.OffsetX = .5
	d.Zones = []Zone{{ID: "last", Cells: []int{29}}}
	s := InitialState()
	s.Zones["last"] = "visible"
	if Visibility(d, s, .1, 1.1) != "hidden" {
		t.Fatal("negative grid column wrapped to preceding row")
	}
}
