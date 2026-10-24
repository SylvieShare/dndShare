package web

import (
	"regexp"
	"strings"
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
	// Independently generated with Python hashlib.pbkdf2_hmac("sha1", b"secret",
	// bytes(range(16)), 65536, 16); this must not call hashPassword.
	const token = "$31$16$AAECAwQFBgcICQoLDA0OD3ObHey8uJ-pz9hvYzRMSBw"
	if !verifyPassword("secret", token) {
		t.Fatal("stored PBKDF2/SHA1 vector rejected")
	}
	for _, invalid := range []string{"", "$31$16$short", "$32$16$" + token[7:], "$31$31$" + token[7:], "$31$16$" + strings.Repeat("!", 43), token[:len(token)-1]} {
		if verifyPassword("secret", invalid) {
			t.Errorf("invalid token accepted: %q", invalid)
		}
	}
	if verifyPassword("wrong", token) {
		t.Fatal("incorrect password accepted")
	}
}
