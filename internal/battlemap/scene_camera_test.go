package battlemap

import (
	"math"
	"testing"
)

func testSceneView() CameraView {
	return CameraView{Position: [3]float64{4, 2, 5}, Target: [3]float64{4, 6, .44}, Up: [3]float64{0, 0, 1}, Width: 8, Aspect: 16.0 / 9}
}
func TestSceneCameraValidationAndResolution(t *testing.T) {
	v := testSceneView()
	if !ValidCameraView(v) {
		t.Fatal("valid view rejected")
	}
	for _, change := range []func(*CameraView){func(v *CameraView) { v.Target = v.Position }, func(v *CameraView) { v.Up = [3]float64{} }, func(v *CameraView) { v.Width = math.NaN() }, func(v *CameraView) { v.Aspect = 0 }, func(v *CameraView) { v.Up = [3]float64{0, 1, -1.14} }} {
		invalid := v
		change(&invalid)
		if ValidCameraView(invalid) {
			t.Fatalf("accepted invalid view %+v", invalid)
		}
	}
	d := Document{Cameras: []SceneCamera{{ID: "camera", Name: "Вход", View: v}}}
	c := ResolveDisplayCamera(d, Camera{SceneID: "camera"})
	if c.View == nil || *c.View != v {
		t.Fatal("did not resolve saved camera")
	}
	d.Cameras[0].View.Width = 12
	if c.View.Width != 8 {
		t.Fatal("resolved pose aliases document")
	}
	frozen := ResolveDisplayCamera(Document{}, c)
	if frozen.View.Width != 8 {
		t.Fatal("deleted source lost last frame")
	}
}
func TestImageDocumentGridAndFormat(t *testing.T) {
	d := Document{Version: DocumentVersion, Kind: "image", Width: 30, Height: 20, Grid: Grid{Visible: true}, Image: &MapImage{ID: 1, PixelWidth: 1500, PixelHeight: 1000, CellPixels: 50}}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	d.Cameras = []SceneCamera{{ID: "camera", Name: "Вход", View: testSceneView()}}
	if ValidateDocument(&d) == nil {
		t.Fatal("camera allowed on image map")
	}
	d.Cameras = nil
	d.Image.CellPixels = 0
	if ValidateDocument(&d) == nil {
		t.Fatal("zero grid scale allowed")
	}
	d.Image.CellPixels = 50
	d.Kind = "tiles"
	if ValidateDocument(&d) == nil {
		t.Fatal("image allowed on tile map")
	}
}
func TestSurfaceCellUsesExplicitBindingAndRotatesFootprint(t *testing.T) {
	m := ModelMetadata{Width: 3, Height: 2}
	p := PlacementPoint{X: .25, Y: .3, Elevation: 2, Cell: &GridCell{2, 0}}
	for _, tt := range []struct {
		rotation int
		cell     GridCell
	}{{0, GridCell{7, 4}}, {90, GridCell{6, 6}}, {180, GridCell{5, 5}}, {270, GridCell{5, 4}}} {
		if got := SurfaceCell(Tile{X: 5, Y: 4, Rotation: tt.rotation}, m, p); got != tt.cell {
			t.Fatalf("%d: %v", tt.rotation, got)
		}
	}
}
