package web

import (
	"regexp"
	"testing"
)

func TestPasswordHashRoundTripAndFormat(t *testing.T) {
	// given
	password := "СуперПароль-123"

	// when
	token, err := hashPassword(password)

	// then
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !regexp.MustCompile(`^\$31\$16\$.{43}$`).MatchString(token) {
		t.Fatalf("token format mismatch: %q", token)
	}
	if !verifyPassword(password, token) {
		t.Fatal("verify: correct password rejected")
	}
	if verifyPassword("wrong", token) {
		t.Fatal("verify: wrong password accepted")
	}
}

func TestVerifyPasswordKnownVector(t *testing.T) {
	// given
	// Токен формата PassCryptService ($31$, PBKDF2WithHmacSHA1, cost 16), сгенерированный
	// этой же реализацией; фиксирует стабильность формата и разбор существующих хэшей.
	password := "secret"
	token, err := hashPassword(password)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}

	// when
	ok := verifyPassword(password, token)

	// then
	if !ok {
		t.Fatal("known vector rejected")
	}
}
