package globalmap

// ChapterID is the first chapter; subsequent chapters retain their display order.
func (p Point) ChapterIDs() []int64 {
	ids := make([]int64, 0, 1+len(p.AdditionalChapterIDs))
	if p.ChapterID != nil {
		ids = append(ids, *p.ChapterID)
	}
	return append(ids, p.AdditionalChapterIDs...)
}

func hasLinks(p Point) bool {
	return p.ChapterID != nil || len(p.AdditionalChapterIDs) > 0 || len(p.LocationIDs) > 0
}

func validLinks(p Point) bool {
	if p.ChapterID == nil && len(p.AdditionalChapterIDs) > 0 {
		return false
	}
	for _, ids := range [][]int64{p.ChapterIDs(), p.LocationIDs} {
		if len(ids) > 64 {
			return false
		}
		seen := map[int64]bool{}
		for _, id := range ids {
			if id <= 0 || seen[id] {
				return false
			}
			seen[id] = true
		}
	}
	return true
}

func keepIDs(ids []int64, allowed map[int64]bool) []int64 {
	kept := []int64{}
	for _, id := range ids {
		if allowed[id] {
			kept = append(kept, id)
		}
	}
	return kept
}
