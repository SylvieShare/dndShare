package cyberpunkred

func MaximumHP(v map[string]any) int {
	stats := object(v["stats"])
	body, will := num(stats["BODY"]), num(stats["WILL"])
	lace, frame := 0, 0
	for _, raw := range array(object(v["cyberware"])["installations"]) {
		e := object(raw)
		switch str(e["key"]) {
		case "cyberware-grafted-muscle-and-bone-lace":
			lace++
		case "cyberware-implanted-linear-frame-sigma":
			frame = max(frame, 12)
		case "cyberware-implanted-linear-frame-beta":
			frame = max(frame, 14)
		}
	}
	if lace > 0 {
		body = min(10, body+2*lace)
	}
	body = max(body, frame)
	return 10 + 5*((max(1, body)+max(1, will)+1)/2)
}
