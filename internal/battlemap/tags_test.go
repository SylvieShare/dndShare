package battlemap

import (
	"reflect"
	"strings"
	"testing"
)

func TestMapTagNormalization(t *testing.T) {
	d := testPresets()[0].Document
	d.Tags = []string{" Лес ", "лес", "", "темная  пещера"}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(d.Tags, []string{"Лес", "темная пещера"}) {
		t.Fatal(d.Tags)
	}
	d.Tags = nil
	if err := ValidateDocument(&d); err != nil || d.Tags == nil {
		t.Fatal("empty tags not normalized", err)
	}
	for _, tags := range [][]string{{strings.Repeat("я", 65)}, make([]string, 33)} {
		d.Tags = tags
		if ValidateDocument(&d) == nil {
			t.Fatal("invalid tags accepted")
		}
	}
}
func TestOnly3DMapsAreAvailable(t *testing.T) {
	for _, p := range testPresets() {
		if p.Document.Kind != "tiles" {
			t.Fatal("image preset remains", p.ID)
		}
	}
	for _, kind := range []string{"image", "image-grid"} {
		d := testPresets()[0].Document
		d.Kind = kind
		if ValidateDocument(&d) == nil {
			t.Fatal("image map accepted", kind)
		}
	}
}
