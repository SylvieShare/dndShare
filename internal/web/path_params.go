package web

import (
	"net/http"
	"strconv"
)

// pathInt64 разбирает числовой path-параметр или отвечает 400.
func pathInt64(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	v, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil {
		badRequest(w, "bad "+name)
		return 0, false
	}
	return v, true
}

func positivePathID(w http.ResponseWriter, r *http.Request, key string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(key), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "Некорректный идентификатор")
		return 0, false
	}
	return id, true
}
