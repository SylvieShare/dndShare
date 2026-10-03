package store

func potionTestEntries(doc transferDocument) []any {
	return array(object(array(object(doc.values()["items"])["sections"])[0])["items"])
}
