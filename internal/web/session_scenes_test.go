package web

import "testing"

func TestValidSceneItemType(t *testing.T) {
	for _, typ := range []string{"text", "list", "combat", "reward", "image", "material"} {
		if !validSceneItemType(typ) {
			t.Fatalf("validSceneItemType(%q) = false", typ)
		}
	}
	if validSceneItemType("unknown") {
		t.Fatal("validSceneItemType accepts an unknown type")
	}
}

func TestSceneItemWidth(t *testing.T) {
	tests := []struct {
		name  string
		width float64
		typ   string
		want  float64
	}{
		{name: "text default", typ: "text", want: 300},
		{name: "combat default", typ: "combat", want: 360},
		{name: "reward default", typ: "reward", want: 320},
		{name: "material default", typ: "material", want: 360},
		{name: "minimum", width: 100, typ: "text", want: 220},
		{name: "maximum", width: 900, typ: "combat", want: 640},
		{name: "custom", width: 412, typ: "list", want: 412},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := sceneItemWidth(test.width, test.typ); got != test.want {
				t.Fatalf("sceneItemWidth(%v, %q) = %v, want %v", test.width, test.typ, got, test.want)
			}
		})
	}
}
