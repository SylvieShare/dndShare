package web

import (
	"dndshare/internal/documentpatch"
	"dndshare/internal/documentsync"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
)

// The application currently runs one process; a restart explicitly falls back
// to durable snapshots. No in-memory receipt is treated as durable history.
var documentUpdates = documentsync.New()

func readDocumentMutation(w http.ResponseWriter, r *http.Request) (documentsync.Mutation, bool) {
	var mutation documentsync.Mutation
	if decodeJSON(r, &mutation) != nil || !isUUID(mutation.MutationID) || mutation.BaseVersion < 0 || len(mutation.Patches) > 10000 || len(mutation.Metadata) > 1000 {
		badRequest(w, "Некорректный пакет изменений")
		return mutation, false
	}
	return mutation, true
}
func documentReceipt(w http.ResponseWriter, key string, mutation documentsync.Mutation) bool {
	update, exists, valid := documentUpdates.Receipt(key, mutation.MutationID, mutation.Fingerprint())
	if !exists {
		return false
	}
	if !valid {
		badRequest(w, "Идентификатор операции уже использован для другого пакета")
	} else {
		writeJSON(w, http.StatusOK, update)
	}
	return true
}
func documentPatchError(w http.ResponseWriter, err error) {
	if errors.Is(err, documentpatch.ErrPatch) {
		conflict(w, "Структура документа изменилась; загрузите изменения")
		return
	}
	mapError(w, err)
}
func documentVersion(r *http.Request) int64 {
	version, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	return version
}
func encodeDocument(value any) json.RawMessage { data, _ := json.Marshal(value); return data }
func validDocumentRoots(operations []documentpatch.Operation, allowed ...string) bool {
	for _, operation := range operations {
		if len(operation.Path) == 0 {
			return false
		}
		first, ok := operation.Path[0].(string)
		if !ok {
			return false
		}
		valid := false
		for _, key := range allowed {
			valid = valid || key == first
		}
		if !valid {
			return false
		}
	}
	return true
}
