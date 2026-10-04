package store

import _ "embed"

//go:embed schema/150_battle_maps.sql
var schemaBattleMapsSQL string

//go:embed schema/166_3d_maps.sql
var schema3DMapsSQL string
