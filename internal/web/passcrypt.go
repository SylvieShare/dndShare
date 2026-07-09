package web

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base64"
	"regexp"
	"strconv"
)

// Порт PassCryptService: собственный формат "$31$<cost>$<base64url(salt||dk)>" поверх
// PBKDF2WithHmacSHA1. Совместим с уже существующими хэшами в базе — НЕ менять параметры.
const (
	passCryptCost = 16  // 1<<16 итераций по умолчанию
	passCryptSize = 128 // бит: и salt (16 байт), и производный ключ (16 байт)
)

var passCryptLayout = regexp.MustCompile(`^\$31\$(\d\d?)\$(.{43})$`)

// hashPassword хэширует пароль в формат "$31$16$...".
func hashPassword(password string) (string, error) {
	salt := make([]byte, passCryptSize/8)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	dk, err := pbkdf2.Key(sha1.New, password, salt, 1<<passCryptCost, passCryptSize/8)
	if err != nil {
		return "", err
	}
	buf := make([]byte, 0, len(salt)+len(dk))
	buf = append(buf, salt...)
	buf = append(buf, dk...)
	return "$31$" + strconv.Itoa(passCryptCost) + "$" + base64.RawURLEncoding.EncodeToString(buf), nil
}

// verifyPassword проверяет пароль против хранимого токена в постоянное время.
func verifyPassword(password, token string) bool {
	m := passCryptLayout.FindStringSubmatch(token)
	if m == nil {
		return false
	}
	cost, err := strconv.Atoi(m[1])
	if err != nil || cost < 0 || cost > 30 {
		return false
	}
	raw, err := base64.RawURLEncoding.DecodeString(m[2])
	if err != nil || len(raw) <= passCryptSize/8 {
		return false
	}
	saltLen := passCryptSize / 8
	salt := raw[:saltLen]
	stored := raw[saltLen:]
	dk, err := pbkdf2.Key(sha1.New, password, salt, 1<<cost, len(stored))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(dk, stored) == 1
}
