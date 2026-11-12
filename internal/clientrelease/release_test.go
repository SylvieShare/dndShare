package clientrelease

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
)

func TestParseEnvelopeRejectsOtherApplicationsAndBrokenPayloads(t *testing.T) {
	value := map[string]any{"format": 1, "applicationId": "ru.dndshare.client", "bundleSha256": strings.Repeat("a", 64)}
	encoded := func() []byte {
		payload, _ := json.Marshal(value)
		data, _ := json.Marshal(Envelope{Payload: base64.StdEncoding.EncodeToString(payload), Signature: "signed-by-pipeline"})
		return data
	}
	if _, manifest, err := ParseEnvelope(encoded()); err != nil || manifest.BundleSHA256 == "" {
		t.Fatal("cannot parse embedded release", err)
	}
	value["applicationId"] = "another.app"
	if _, _, err := ParseEnvelope(encoded()); err == nil {
		t.Fatal("accepted another application")
	}
	if _, _, err := ParseEnvelope([]byte(`{"payload":"not base64"}`)); err == nil {
		t.Fatal("accepted corrupted envelope")
	}
	if _, err := OpenBundle("../../outside"); err == nil {
		t.Fatal("unsafe bundle path")
	}
}
