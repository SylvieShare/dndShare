package assets

import (
	"embed"
	"io/fs"
)

// dist — собранный фронт (frontend/dist), вшитый в бинарь.
// deploy/deploy.sh кладёт сюда реальную сборку; в репозитории — плейсхолдер,
// чтобы `go build` работал и без предварительной сборки фронта.
//
//go:embed all:dist
var dist embed.FS

// Dist возвращает файловую систему корня собранного фронта.
func Dist() fs.FS {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err) // невозможно: путь статический
	}
	return sub
}
