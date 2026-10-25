package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/documentpatch"
	"dndshare/internal/documentsync"
	"dndshare/internal/store"
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"testing"
)

func testLargeMapMutation(t *testing.T, st *store.Store, request func(int64, string, string, string) *httptest.ResponseRecorder) {
	t.Helper()
	var floor battlemap.Model
	for _, model := range battlemap.InitialCatalogue() {
		if model.TileType == "floor" && model.Width == 1 && model.Height == 1 {
			floor = model
			break
		}
	}
	if floor.ID == "" {
		t.Fatal("floor fixture missing")
	}
	if _, err := st.RegisterMapModel(t.Context(), floor); err != nil {
		t.Fatal(err)
	}
	tiles, rotated := make([]battlemap.Tile, 4096), make([]battlemap.Tile, 4096)
	for i := range tiles {
		x, y := i%64, i/64
		tiles[i] = battlemap.Tile{ID: "tile-" + strconv.Itoa(i), ModelID: floor.ID, X: x, Y: y}
		rotated[i] = tiles[i]
		rotated[i].X, rotated[i].Y, rotated[i].Rotation = 63-y, x, 90
	}
	m, err := st.SaveBattleMap(t.Context(), 1, store.BattleMap{Name: "Large", Document: battlemap.Document{
		Version: 2, Kind: "tiles", Width: 64, Height: 64, Sun: battlemap.DefaultSun(), Tiles: tiles,
	}})
	if err != nil {
		t.Fatal(err)
	}
	if err = st.HydrateMapLights(t.Context(), &m.Document); err != nil {
		t.Fatal(err)
	}
	path := "/api/maps/" + m.ID
	for i, collection := range [][]battlemap.Tile{rotated, tiles} {
		value, _ := json.Marshal(collection)
		packet, _ := json.Marshal(documentsync.Mutation{BaseVersion: m.Revision,
			MutationID: "79000000-0000-4000-8000-00000000000" + strconv.Itoa(i+1),
			Patches:    []documentpatch.Operation{{Op: "set", Path: []any{"document", "tiles"}, Value: value}},
		})
		before := mapSnapshot(m).Data
		response := request(1, "PATCH", path, string(packet))
		if response.Code != 200 {
			t.Fatal(response.Code, response.Body.String())
		}
		var update documentsync.Update
		if err = json.Unmarshal(response.Body.Bytes(), &update); err != nil {
			t.Fatal(err)
		}
		if len(update.Patches) > 10000 {
			t.Fatal("oversized acknowledgement", len(update.Patches))
		}
		replayed, err := documentpatch.Apply(before, update.Patches)
		if err != nil {
			t.Fatal(err)
		}
		m, err = st.GetBattleMap(t.Context(), 1, m.ID)
		if err != nil {
			t.Fatal(err)
		}
		if err = st.HydrateMapLights(t.Context(), &m.Document); err != nil {
			t.Fatal(err)
		}
		actual, _ := documentpatch.Decode(replayed)
		expected, _ := documentpatch.Decode(mapSnapshot(m).Data)
		if !documentpatch.Equal(actual, expected) {
			difference, _ := documentpatch.Diff(replayed, mapSnapshot(m).Data)
			for _, operation := range difference {
				t.Log(operation.Op, operation.Path)
			}
			t.Fatal("acknowledgement did not reproduce saved map")
		}
	}
}
