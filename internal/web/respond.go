package web

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
)

// maxJSONBody — верхний предел тела JSON-запроса. Крупнейший легитимный запрос —
// полный лист персонажа (data), поэтому лимит щедрый, но защищает от буферизации
// многогигабайтного тела в память (в т.ч. на неавторизованных /user/auth, /registration).
const maxJSONBody int64 = 16 << 20

// errorBody повторяет ErrorResponse прежней версии: {"type":..,"desc":..} с NON_NULL —
// null-поля опускаются (потому оба поля — указатели с omitempty).
type errorBody struct {
	Type *string `json:"type,omitempty"`
	Desc *string `json:"desc,omitempty"`
}

// writeJSON сериализует body как JSON. nil-body → пустое тело (для 200/204 без данных).
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body != nil {
		if err := json.NewEncoder(w).Encode(body); err != nil {
			log.Printf("encode json: %v", err)
		}
	}
}

// apiError отдаёт {"type":..,"desc":..} с нужным статусом (как RestResponseEntityExceptionHandler).
func apiError(w http.ResponseWriter, status int, typ, desc string) {
	body := errorBody{}
	if typ != "" {
		body.Type = &typ
	}
	if desc != "" {
		body.Desc = &desc
	}
	writeJSON(w, status, body)
}

// serverError логирует причину и отдаёт 500 с типом ошибки, но без деталей.
func serverError(w http.ResponseWriter, err error) {
	log.Printf("500: %v", err)
	apiError(w, http.StatusInternalServerError, "ServerException", "Внутренняя ошибка")
}

func badRequest(w http.ResponseWriter, desc string) {
	apiError(w, http.StatusBadRequest, "BadRequestException", desc)
}

func unauthorized(w http.ResponseWriter) {
	apiError(w, http.StatusUnauthorized, "NoneAuthException", "")
}

func forbidden(w http.ResponseWriter) {
	apiError(w, http.StatusForbidden, "ForbiddenException", "")
}

func notFound(w http.ResponseWriter, desc string) {
	apiError(w, http.StatusNotFound, "NotFoundException", desc)
}

func conflict(w http.ResponseWriter, desc string) {
	apiError(w, http.StatusConflict, "ConflictException", desc)
}

func tooManyRequests(w http.ResponseWriter, retryAfter time.Duration) {
	seconds := int64(retryAfter.Round(time.Second) / time.Second)
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.FormatInt(seconds, 10))
	apiError(w, http.StatusTooManyRequests, "TooManyRequestsException", "Слишком много попыток. Попробуйте позже")
}

func decodeJSON(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, maxJSONBody)
	return json.NewDecoder(r.Body).Decode(dst)
}
