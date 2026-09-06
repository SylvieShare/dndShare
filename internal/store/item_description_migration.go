package store

import (
	"bytes"
	"context"
	"fmt"
	"html"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	xhtml "golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

type itemDescriptionMigrationStats struct {
	Items      int
	DiceNodes  int
	StatNodes  int
	ItemLinks  int
	LinksClean int
}

type descriptionConversion struct {
	DiceNodes  int
	StatNodes  int
	ItemLinks  int
	LinksClean int
}

type descriptionReference struct {
	ref             legacyRichItemRef
	pattern         *regexp.Regexp
	needle          string
	singleWordSpell bool
}

type descriptionMatch struct {
	start int
	end   int
	kind  string
	stat  string
	ref   legacyRichItemRef
}

var (
	descriptionBlockHTMLRE = regexp.MustCompile(`(?i)<\s*(?:p|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|td|th|br)\b`)
	descriptionDiceRE      = regexp.MustCompile(`(?i)(?:[0-9]+\s*)?[dдк]\s*(?:100|20|12|10|8|6|4|3)(?:\s*(?:\+|-|−|–|—|×|x|\*)\s*(?:(?:[0-9]+\s*)?[dдк]\s*(?:100|20|12|10|8|6|4|3)|[0-9]+))*`)
	descriptionStatRE      = regexp.MustCompile(`(?i)класс\s+(?:доспеха|брони)\s*:?\s*[0-9]+|жизни\s*:\s*[0-9]+|очк(?:о|а|и|ов|ам|ами|ах)?\s+жизни|кд(?:\s+[0-9]+)?|хит(?:ы|ов|а|ам|ами|ах)?`)
	descriptionTableRuleRE = regexp.MustCompile(`^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$`)
	descriptionWordRuneRE  = regexp.MustCompile(`[\pL\pN]`)
)

func migrateItemRichDescriptions(ctx context.Context, tx pgx.Tx) (itemDescriptionMigrationStats, error) {
	resolver, err := loadLegacyRichResolver(ctx, tx)
	if err != nil {
		return itemDescriptionMigrationStats{}, err
	}
	references := buildDescriptionReferences(resolver)
	rows, err := tx.Query(ctx, `
		SELECT id, data ->> 'desc'
		FROM dndshare.item
		WHERE user_id IS NULL AND type_id = 2
		  AND jsonb_typeof(data -> 'desc') = 'string'
		ORDER BY id`)
	if err != nil {
		return itemDescriptionMigrationStats{}, fmt.Errorf("query item descriptions: %w", err)
	}
	type itemDescription struct {
		id   int64
		desc string
	}
	items := []itemDescription{}
	for rows.Next() {
		var item itemDescription
		if err := rows.Scan(&item.id, &item.desc); err != nil {
			rows.Close()
			return itemDescriptionMigrationStats{}, fmt.Errorf("scan item description: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return itemDescriptionMigrationStats{}, fmt.Errorf("read item descriptions: %w", err)
	}
	rows.Close()

	stats := itemDescriptionMigrationStats{}
	for _, item := range items {
		conversion := descriptionConversion{}
		converted, changed, err := convertItemDescription(item.desc, item.id, resolver, references, &conversion)
		if err != nil {
			return stats, fmt.Errorf("convert item %d description: %w", item.id, err)
		}
		if !changed {
			continue
		}
		if _, err := tx.Exec(ctx, `UPDATE dndshare.item SET data = jsonb_set(data, '{desc}', to_jsonb($2::text), true) WHERE id = $1`, item.id, converted); err != nil {
			return stats, fmt.Errorf("save item %d description: %w", item.id, err)
		}
		stats.Items++
		stats.DiceNodes += conversion.DiceNodes
		stats.StatNodes += conversion.StatNodes
		stats.ItemLinks += conversion.ItemLinks
		stats.LinksClean += conversion.LinksClean
	}
	return stats, nil
}

func buildDescriptionReferences(resolver *legacyRichResolver) []descriptionReference {
	seen := map[string]bool{}
	references := []descriptionReference{}
	for _, typeID := range []int64{5, 6, 15, 2} {
		for _, candidates := range resolver.items[typeID] {
			if len(candidates) == 0 {
				continue
			}
			ref := candidates[0]
			name := strings.TrimSpace(ref.Name)
			key := fmt.Sprintf("%d:%s", typeID, strings.ToLower(name))
			if seen[key] || utf8.RuneCountInString(name) < 4 {
				continue
			}
			if typeID == 2 && (!strings.Contains(name, " ") || utf8.RuneCountInString(name) < 8) {
				continue
			}
			seen[key] = true
			references = append(references, descriptionReference{
				ref:             ref,
				pattern:         regexp.MustCompile(`(?i)(?:^|[^\pL\pN])(` + regexp.QuoteMeta(name) + `)(?:$|[^\pL\pN])`),
				needle:          strings.ToLower(name),
				singleWordSpell: typeID == 5 && !strings.Contains(name, " "),
			})
		}
	}
	sort.Slice(references, func(i, j int) bool {
		left := utf8.RuneCountInString(references[i].ref.Name)
		right := utf8.RuneCountInString(references[j].ref.Name)
		if left != right {
			return left > right
		}
		if references[i].ref.TypeID != references[j].ref.TypeID {
			return references[i].ref.TypeID < references[j].ref.TypeID
		}
		return references[i].ref.ID < references[j].ref.ID
	})
	return references
}

func convertItemDescription(source string, itemID int64, resolver *legacyRichResolver, references []descriptionReference, conversion *descriptionConversion) (string, bool, error) {
	normalized := strings.ReplaceAll(source, `\r\n`, "\n")
	normalized = strings.ReplaceAll(normalized, `\n`, "\n")
	normalized = strings.ReplaceAll(normalized, `\r`, "\n")
	normalized = strings.TrimSpace(normalized)
	if normalized == "" {
		return source, false, nil
	}
	if strings.Contains(normalized, "|---") && descriptionBlockHTMLRE.MatchString(normalized) {
		plain, err := descriptionHTMLText(normalized)
		if err != nil {
			return source, false, err
		}
		normalized = plainDescriptionHTML(plain)
	} else if !descriptionBlockHTMLRE.MatchString(normalized) {
		normalized = plainDescriptionHTML(normalized)
	}

	contextNode := &xhtml.Node{Type: xhtml.ElementNode, Data: "div", DataAtom: atom.Div}
	nodes, err := xhtml.ParseFragment(strings.NewReader(normalized), contextNode)
	if err != nil {
		return source, false, fmt.Errorf("parse html fragment: %w", err)
	}
	root := &xhtml.Node{Type: xhtml.ElementNode, Data: "div", DataAtom: atom.Div}
	for _, node := range nodes {
		root.AppendChild(node)
	}
	cleanDescriptionLinks(root, resolver, conversion)
	transformDescriptionTextNodes(root, itemID, references, conversion)

	var output bytes.Buffer
	for child := root.FirstChild; child != nil; child = child.NextSibling {
		if err := xhtml.Render(&output, child); err != nil {
			return source, false, fmt.Errorf("render html fragment: %w", err)
		}
	}
	result := output.String()
	return result, result != source, nil
}

func descriptionHTMLText(source string) (string, error) {
	contextNode := &xhtml.Node{Type: xhtml.ElementNode, Data: "div", DataAtom: atom.Div}
	nodes, err := xhtml.ParseFragment(strings.NewReader(source), contextNode)
	if err != nil {
		return "", fmt.Errorf("parse mixed markdown html: %w", err)
	}
	root := &xhtml.Node{Type: xhtml.ElementNode, Data: "div", DataAtom: atom.Div}
	for _, node := range nodes {
		root.AppendChild(node)
	}
	return strings.TrimSpace(htmlText(root)), nil
}

func plainDescriptionHTML(source string) string {
	lines := strings.Split(source, "\n")
	var output strings.Builder
	for index := 0; index < len(lines); {
		line := strings.TrimSpace(lines[index])
		if line == "" {
			index++
			continue
		}
		if strings.HasPrefix(line, "|") && index+1 < len(lines) && descriptionTableRuleRE.MatchString(lines[index+1]) {
			end := index + 2
			for end < len(lines) && strings.HasPrefix(strings.TrimSpace(lines[end]), "|") {
				end++
			}
			output.WriteString(markdownTableHTML(lines[index:end]))
			index = end
			continue
		}
		if strings.HasPrefix(line, "- ") {
			output.WriteString("<ul>")
			for index < len(lines) {
				entry := strings.TrimSpace(lines[index])
				if !strings.HasPrefix(entry, "- ") {
					break
				}
				output.WriteString("<li>" + markdownInline(strings.TrimSpace(strings.TrimPrefix(entry, "- "))) + "</li>")
				index++
			}
			output.WriteString("</ul>")
			continue
		}
		output.WriteString("<p>" + markdownInline(line) + "</p>")
		index++
	}
	return output.String()
}

func markdownInline(source string) string {
	escaped := html.EscapeString(source)
	strongEm := regexp.MustCompile(`\*\*\*([^*]+)\*\*\*`)
	strong := regexp.MustCompile(`\*\*([^*]+)\*\*`)
	escaped = strongEm.ReplaceAllString(escaped, `<strong><em>$1</em></strong>`)
	return strong.ReplaceAllString(escaped, `<strong>$1</strong>`)
}

func markdownTableHTML(lines []string) string {
	if len(lines) < 2 {
		return ""
	}
	parseRow := func(line string) []string {
		line = strings.TrimSpace(strings.Trim(line, "|"))
		parts := strings.Split(line, "|")
		for index := range parts {
			parts[index] = strings.TrimSpace(parts[index])
		}
		return parts
	}
	var output strings.Builder
	output.WriteString("<table><thead><tr>")
	for _, cell := range parseRow(lines[0]) {
		output.WriteString("<th>" + markdownInline(cell) + "</th>")
	}
	output.WriteString("</tr></thead><tbody>")
	for _, line := range lines[2:] {
		output.WriteString("<tr>")
		for _, cell := range parseRow(line) {
			output.WriteString("<td>" + markdownInline(cell) + "</td>")
		}
		output.WriteString("</tr>")
	}
	output.WriteString("</tbody></table>")
	return output.String()
}

func cleanDescriptionLinks(root *xhtml.Node, resolver *legacyRichResolver, conversion *descriptionConversion) {
	var walk func(*xhtml.Node)
	walk = func(parent *xhtml.Node) {
		for node := parent.FirstChild; node != nil; {
			next := node.NextSibling
			if node.Type == xhtml.ElementNode && strings.EqualFold(node.Data, "a") {
				legacyConversion := legacyRichConversion{}
				if convertLegacyAnchor(parent, node, resolver, "", &legacyConversion) {
					conversion.ItemLinks += legacyConversion.ItemNodes + legacyConversion.SuggestNodes
				} else {
					for child := node.FirstChild; child != nil; {
						childNext := child.NextSibling
						node.RemoveChild(child)
						parent.InsertBefore(child, node)
						child = childNext
					}
					parent.RemoveChild(node)
					conversion.LinksClean++
				}
				node = next
				continue
			}
			if node.Type == xhtml.ElementNode {
				walk(node)
			}
			node = next
		}
	}
	walk(root)
}

func transformDescriptionTextNodes(root *xhtml.Node, itemID int64, references []descriptionReference, conversion *descriptionConversion) {
	var walk func(*xhtml.Node, bool)
	walk = func(parent *xhtml.Node, blocked bool) {
		for node := parent.FirstChild; node != nil; {
			next := node.NextSibling
			childBlocked := blocked
			if node.Type == xhtml.ElementNode {
				name := strings.ToLower(node.Data)
				childBlocked = childBlocked || name == "code" || name == "pre" || htmlAttr(node, "data-rich-node") != ""
				walk(node, childBlocked)
			} else if node.Type == xhtml.TextNode && !blocked {
				transformDescriptionTextNode(parent, node, itemID, references, conversion)
			}
			node = next
		}
	}
	walk(root, false)
}

func transformDescriptionTextNode(parent, node *xhtml.Node, itemID int64, references []descriptionReference, conversion *descriptionConversion) {
	text := node.Data
	matches := descriptionMatches(text, itemID, references)
	if len(matches) == 0 {
		return
	}
	position := 0
	for _, match := range matches {
		if match.start > position {
			parent.InsertBefore(&xhtml.Node{Type: xhtml.TextNode, Data: text[position:match.start]}, node)
		}
		label := text[match.start:match.end]
		switch match.kind {
		case "dice":
			formula := strings.NewReplacer("д", "d", "Д", "d", "−", "-", "–", "-", "—", "-", "×", "*").Replace(label)
			parent.InsertBefore(richDiceNode(strings.TrimSpace(formula), "", nil), node)
			conversion.DiceNodes++
		case "stat":
			payload := struct {
				Stat string `json:"stat"`
			}{Stat: match.stat}
			parent.InsertBefore(richNode("stat", payload, label), node)
			conversion.StatNodes++
		case "item":
			parent.InsertBefore(richEntityNode("item", match.ref.ID, match.ref.TypeID, label), node)
			conversion.ItemLinks++
		}
		position = match.end
	}
	if position < len(text) {
		parent.InsertBefore(&xhtml.Node{Type: xhtml.TextNode, Data: text[position:]}, node)
	}
	parent.RemoveChild(node)
}

func descriptionMatches(text string, itemID int64, references []descriptionReference) []descriptionMatch {
	candidates := []descriptionMatch{}
	lowerText := strings.ToLower(text)
	for _, indexes := range descriptionDiceRE.FindAllStringIndex(text, -1) {
		if !descriptionWordBoundary(text, indexes[0], indexes[1]) {
			continue
		}
		candidates = append(candidates, descriptionMatch{start: indexes[0], end: indexes[1], kind: "dice"})
	}
	for _, indexes := range descriptionStatRE.FindAllStringIndex(text, -1) {
		if !descriptionWordBoundary(text, indexes[0], indexes[1]) {
			continue
		}
		label := strings.ToLower(text[indexes[0]:indexes[1]])
		stat := "hp"
		if strings.HasPrefix(label, "кд") || strings.HasPrefix(label, "класс") {
			stat = "ac"
		}
		candidates = append(candidates, descriptionMatch{start: indexes[0], end: indexes[1], kind: "stat", stat: stat})
	}
	for _, reference := range references {
		if reference.ref.ID == itemID || !strings.Contains(lowerText, reference.needle) {
			continue
		}
		for _, indexes := range reference.pattern.FindAllStringSubmatchIndex(text, -1) {
			start, end := indexes[2], indexes[3]
			if reference.singleWordSpell && !singleWordSpellContext(text, start) {
				continue
			}
			candidates = append(candidates, descriptionMatch{start: start, end: end, kind: "item", ref: reference.ref})
		}
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].start != candidates[j].start {
			return candidates[i].start < candidates[j].start
		}
		leftLength := candidates[i].end - candidates[i].start
		rightLength := candidates[j].end - candidates[j].start
		if leftLength != rightLength {
			return leftLength > rightLength
		}
		priority := map[string]int{"dice": 0, "stat": 1, "item": 2}
		return priority[candidates[i].kind] < priority[candidates[j].kind]
	})
	selected := []descriptionMatch{}
	for _, candidate := range candidates {
		if len(selected) > 0 && candidate.start < selected[len(selected)-1].end {
			continue
		}
		selected = append(selected, candidate)
	}
	return selected
}

func descriptionWordBoundary(text string, start, end int) bool {
	if start > 0 {
		previous, _ := utf8.DecodeLastRuneInString(text[:start])
		if descriptionWordRuneRE.MatchString(string(previous)) {
			return false
		}
	}
	if end < len(text) {
		next, _ := utf8.DecodeRuneInString(text[end:])
		if descriptionWordRuneRE.MatchString(string(next)) {
			return false
		}
	}
	return true
}

func singleWordSpellContext(text string, start int) bool {
	contextStart := start - 40
	if contextStart < 0 {
		contextStart = 0
	}
	context := strings.ToLower(text[contextStart:start])
	return strings.Contains(context, "заклинан") || strings.LastIndex(context, "«") > strings.LastIndex(context, "»")
}
