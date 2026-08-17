package bestiaryimages

import "testing"

func TestObjectKey(t *testing.T) {
	got, err := ObjectKey("/creatures/kobold.webp", "kobold inventor")
	if err != nil {
		t.Fatal(err)
	}
	if want := "bestiary/v1/kobold-inventor.webp"; got != want {
		t.Fatalf("ObjectKey() = %q, want %q", got, want)
	}
}
