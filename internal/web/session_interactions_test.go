package web

import "testing"

func TestInteractionRequestAndDedicatedRoutes(t *testing.T) {
	valid := createInteractionRequest{SessionUUID: "00000000-0000-4000-8000-000000000001", RecipientCharUUID: "00000000-0000-4000-8000-000000000002", ClientActionID: "00000000-0000-4000-8000-000000000003", Type: "chat_message", Message: "Привет"}
	if !validInteractionRequest(valid) {
		t.Fatal("valid message rejected")
	}
	for _, field := range []string{"session", "recipient", "action"} {
		req := valid
		switch field {
		case "session":
			req.SessionUUID = "invalid"
		case "recipient":
			req.RecipientCharUUID = "invalid"
		case "action":
			req.ClientActionID = "invalid"
		}
		if validInteractionRequest(req) {
			t.Fatalf("invalid %s accepted", field)
		}
	}
	for _, kind := range []string{"chat_message", "rps_challenge"} {
		if allowedSessionEventTypes[kind] {
			t.Fatalf("%s can bypass interaction access checks", kind)
		}
	}
}
