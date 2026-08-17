package store

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var (
	legacyAverageBeforeRE = regexp.MustCompile(`(?s)^(.*?)(-?[0-9]+(?:[.,][0-9]+)?)[\s\p{Z}]*\([\s\p{Z}]*$`)
	legacyAverageAfterRE  = regexp.MustCompile(`^[\s\p{Z}]*\)`)
	legacyDiceTypoRE      = regexp.MustCompile(`(?i)([0-9])r([0-9])`)
	legacySelfClosingDice = regexp.MustCompile(`(?is)<dice-roller\b([^>]*)/>`)
)

func convertLegacyRichHTML(source string, resolver *legacyRichResolver, conversion *legacyRichConversion) (string, bool, error) {
	lowerSource := strings.ToLower(source)
	if !strings.Contains(source, "<") || (!strings.Contains(lowerSource, "dice-roller") &&
		!strings.Contains(lowerSource, "detail-tooltip") && !strings.Contains(lowerSource, "<a")) {
		return source, false, nil
	}
	contextNode := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	parseSource := legacySelfClosingDice.ReplaceAllString(source, `<dice-roller$1></dice-roller>`)
	nodes, err := html.ParseFragment(strings.NewReader(parseSource), contextNode)
	if err != nil {
		return source, false, fmt.Errorf("parse html fragment: %w", err)
	}
	root := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	for _, node := range nodes {
		root.AppendChild(node)
	}
	changed := convertLegacyRichChildren(root, resolver, "", conversion)
	if !changed {
		return source, false, nil
	}
	var output bytes.Buffer
	for child := root.FirstChild; child != nil; child = child.NextSibling {
		if err := html.Render(&output, child); err != nil {
			return source, false, fmt.Errorf("render html fragment: %w", err)
		}
	}
	return output.String(), true, nil
}

func convertLegacyRichChildren(parent *html.Node, resolver *legacyRichResolver, tooltipType string, conversion *legacyRichConversion) bool {
	changed := false
	for node := parent.FirstChild; node != nil; {
		next := node.NextSibling
		if node.Type != html.ElementNode {
			node = next
			continue
		}
		name := strings.ToLower(node.Data)
		switch name {
		case "dice-roller":
			formula := strings.TrimSpace(htmlAttr(node, "formula"))
			formula = legacyDiceTypoRE.ReplaceAllString(formula, `${1}к${2}`)
			if formula != "" {
				label := strings.TrimSpace(htmlAttr(node, "label"))
				average := extractLegacyDiceAverage(node)
				replacement := richDiceNode(formula, label, average)
				parent.InsertBefore(replacement, node)
				parent.RemoveChild(node)
				conversion.DiceNodes++
				if average != nil {
					conversion.DiceAverages++
				}
				changed = true
			}
		case "detail-tooltip":
			childType := htmlAttr(node, "type")
			changed = convertLegacyRichChildren(node, resolver, childType, conversion) || changed
			for child := node.FirstChild; child != nil; {
				childNext := child.NextSibling
				node.RemoveChild(child)
				parent.InsertBefore(child, node)
				child = childNext
			}
			parent.RemoveChild(node)
			changed = true
		case "a":
			changed = convertLegacyAnchor(parent, node, resolver, tooltipType, conversion) || changed
		default:
			changed = convertLegacyRichChildren(node, resolver, tooltipType, conversion) || changed
		}
		node = next
	}
	return changed
}

func convertLegacyAnchor(parent, node *html.Node, resolver *legacyRichResolver, tooltipType string, conversion *legacyRichConversion) bool {
	href := strings.TrimSpace(htmlAttr(node, "href"))
	if href == "" {
		return false
	}
	label := strings.TrimSpace(htmlText(node))
	if item, ok := resolver.resolveItem(tooltipType, href, label); ok {
		parent.InsertBefore(richEntityNode("item", item.ID, item.TypeID, label), node)
		parent.RemoveChild(node)
		conversion.ItemNodes++
		return true
	}
	if suggest, ok := resolver.resolveSuggest(href); ok {
		parent.InsertBefore(richEntityNode("suggest", suggest.ID, suggest.TypeID, label), node)
		parent.RemoveChild(node)
		conversion.SuggestNodes++
		return true
	}
	if normalized, ok := legacyNativeHref(href, tooltipType); ok && normalized != href {
		setHTMLAttr(node, "href", normalized)
		conversion.NativeLinks++
		return true
	}
	return false
}

func legacyNativeHref(href, tooltipType string) (string, bool) {
	trimmed := strings.TrimSpace(href)
	parsed, err := url.Parse(trimmed)
	if err == nil && parsed.IsAbs() {
		if strings.EqualFold(parsed.Hostname(), "ttg.club") || strings.EqualFold(parsed.Hostname(), "dnd5.club") {
			return trimmed, true
		}
		return trimmed, false
	}
	route, slug := legacyHrefParts(trimmed)
	legacyRoute := map[string]bool{
		"screen": true, "screens": true, "spell": true, "spells": true,
		"bestiary": true, "creatures": true, "items": true, "weapons": true,
		"armors": true, "traits": true, "races": true, "classes": true,
		"rules": true, "gods": true,
	}
	if !legacyRoute[route] && strings.TrimSpace(tooltipType) == "" {
		return trimmed, false
	}
	path := strings.TrimLeft(trimmed, "/")
	canonicalRoutes := map[string]string{
		"screen": "screens", "spell": "spells", "creature": "bestiary",
		"magic_item": "items", "item": "items", "weapon": "weapons",
		"armor": "armors", "trait": "traits",
	}
	if canonicalRoute := canonicalRoutes[legacyRichKey(tooltipType)]; canonicalRoute != "" && route != canonicalRoute {
		path = canonicalRoute + "/" + slug
	}
	return "https://ttg.club/" + path, true
}

func extractLegacyDiceAverage(node *html.Node) *float64 {
	previous := node.PrevSibling
	next := node.NextSibling
	if previous == nil || next == nil || previous.Type != html.TextNode || next.Type != html.TextNode {
		return nil
	}
	before := legacyAverageBeforeRE.FindStringSubmatch(previous.Data)
	if len(before) != 3 || !legacyAverageAfterRE.MatchString(next.Data) {
		return nil
	}
	value, err := strconv.ParseFloat(strings.ReplaceAll(before[2], ",", "."), 64)
	if err != nil {
		return nil
	}
	previous.Data = before[1]
	next.Data = legacyAverageAfterRE.ReplaceAllString(next.Data, "")
	return &value
}

func richDiceNode(formula, label string, average *float64) *html.Node {
	payload := struct {
		Formula string   `json:"formula"`
		Label   string   `json:"label,omitempty"`
		Average *float64 `json:"average,omitempty"`
	}{Formula: formula, Label: label, Average: average}
	displayFormula := formula
	if average != nil {
		displayFormula = strconv.FormatFloat(*average, 'f', -1, 64) + " · " + formula
	}
	display := displayFormula
	if label != "" {
		display = label + ": " + displayFormula
	}
	return richNode("dice", payload, display)
}

func richEntityNode(kind string, id, typeID int64, label string) *html.Node {
	payload := struct {
		ID     int64 `json:"id"`
		TypeID int64 `json:"typeId"`
	}{ID: id, TypeID: typeID}
	return richNode(kind, payload, label)
}

func richNode(kind string, payload any, label string) *html.Node {
	encoded, _ := json.Marshal(payload)
	node := &html.Node{
		Type: html.ElementNode,
		Data: "span",
		Attr: []html.Attribute{
			{Key: "data-rich-node", Val: kind},
			{Key: "data-rich-payload", Val: encodeURIComponent(encoded)},
			{Key: "contenteditable", Val: "false"},
		},
	}
	node.AppendChild(&html.Node{Type: html.TextNode, Data: label})
	return node
}

func encodeURIComponent(value []byte) string {
	const hex = "0123456789ABCDEF"
	var output strings.Builder
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || strings.ContainsRune("-_.!~*'()", rune(char)) {
			output.WriteByte(char)
			continue
		}
		output.WriteByte('%')
		output.WriteByte(hex[char>>4])
		output.WriteByte(hex[char&15])
	}
	return output.String()
}

func htmlAttr(node *html.Node, key string) string {
	for _, attr := range node.Attr {
		if strings.EqualFold(attr.Key, key) {
			return attr.Val
		}
	}
	return ""
}

func setHTMLAttr(node *html.Node, key, value string) {
	for index := range node.Attr {
		if strings.EqualFold(node.Attr[index].Key, key) {
			node.Attr[index].Val = value
			return
		}
	}
	node.Attr = append(node.Attr, html.Attribute{Key: key, Val: value})
}

func htmlText(node *html.Node) string {
	var output strings.Builder
	var walk func(*html.Node)
	walk = func(current *html.Node) {
		if current.Type == html.TextNode {
			output.WriteString(current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return output.String()
}
