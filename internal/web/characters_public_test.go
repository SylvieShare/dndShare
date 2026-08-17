package web

import (
	"go/ast"
	"go/parser"
	"go/token"
	"testing"
)

func TestGetTemplatesRemainsPublic(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "characters.go", nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, declaration := range file.Decls {
		function, ok := declaration.(*ast.FuncDecl)
		if !ok || function.Name.Name != "handleGetTemplates" {
			continue
		}
		ast.Inspect(function.Body, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}
			identifier, ok := call.Fun.(*ast.Ident)
			if ok && identifier.Name == "mustUser" {
				t.Error("handleGetTemplates must stay available without authentication")
			}
			return true
		})
		return
	}
	t.Fatal("handleGetTemplates not found")
}
