package web

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesMCP) }

func (s *Server) routesMCP(mux *http.ServeMux) {
	mux.HandleFunc("POST /mcp", s.handleMCP)
	mux.HandleFunc("POST /mcp/", s.handleMCP)
}

const mcpAdminUser = int64(0)

const (
	defaultErrorReportLeaseMinutes = 45
	minErrorReportLeaseMinutes     = 5
	maxErrorReportLeaseMinutes     = 120
)

// --- JSON-RPC 2.0 envelope ---

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

// tools/call result shape.
type mcpContent struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	Data     string `json:"data,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
}

type mcpToolResult struct {
	Content []mcpContent `json:"content"`
	IsError bool         `json:"isError,omitempty"`
}

// handleMCP — bearer-authed JSON-RPC over a single HTTP POST (MCP streamable-HTTP).
func (s *Server) handleMCP(w http.ResponseWriter, r *http.Request) {
	if !s.mcpAuthorized(r) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	var req rpcRequest
	if err := decodeJSON(r, &req); err != nil {
		s.writeRPC(w, rpcErrorResponse(nil, -32700, "Parse error"))
		return
	}
	if req.Method == "" {
		s.writeRPC(w, rpcErrorResponse(req.ID, -32600, "Invalid Request"))
		return
	}
	// Notifications carry no id and expect no response body.
	if len(req.ID) == 0 {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	switch req.Method {
	case "initialize":
		s.writeRPC(w, rpcOKResponse(req.ID, map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]any{"name": "dndshare-handbook", "version": "1.0.0"},
		}))
	case "ping":
		s.writeRPC(w, rpcOKResponse(req.ID, map[string]any{}))
	case "tools/list":
		s.writeRPC(w, rpcOKResponse(req.ID, map[string]any{"tools": mcpToolDefs()}))
	case "tools/call":
		s.writeRPC(w, s.handleToolsCall(r, req))
	default:
		s.writeRPC(w, rpcErrorResponse(req.ID, -32601, "Method not found"))
	}
}

func (s *Server) mcpAuthorized(r *http.Request) bool {
	token := s.cfg.MCPAuthToken
	if token == "" {
		return false
	}
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	got := strings.TrimSpace(header[len(prefix):])
	return subtle.ConstantTimeCompare([]byte(got), []byte(token)) == 1
}

func (s *Server) writeRPC(w http.ResponseWriter, resp rpcResponse) {
	writeJSON(w, http.StatusOK, resp)
}

func rpcOKResponse(id json.RawMessage, result any) rpcResponse {
	raw, err := json.Marshal(result)
	if err != nil {
		return rpcErrorResponse(id, -32603, "Internal error")
	}
	return rpcResponse{JSONRPC: "2.0", ID: rpcID(id), Result: raw}
}

func rpcErrorResponse(id json.RawMessage, code int, msg string) rpcResponse {
	return rpcResponse{JSONRPC: "2.0", ID: rpcID(id), Error: &rpcError{Code: code, Message: msg}}
}

func rpcID(id json.RawMessage) json.RawMessage {
	if len(id) == 0 {
		return json.RawMessage("null")
	}
	return id
}

// handleToolsCall dispatches tools/call. Tool-level failures are reported as a
// successful JSON-RPC result with isError=true (per MCP), not as an RPC error.
func (s *Server) handleToolsCall(r *http.Request, req rpcRequest) rpcResponse {
	var p struct {
		Name      string                     `json:"name"`
		Arguments map[string]json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &p); err != nil {
		return rpcErrorResponse(req.ID, -32602, "Invalid params")
	}
	if p.Arguments == nil {
		p.Arguments = map[string]json.RawMessage{}
	}

	value, err := s.dispatchTool(r, p.Name, p.Arguments)
	if err != nil {
		return rpcOKResponse(req.ID, mcpToolResult{
			Content: []mcpContent{{Type: "text", Text: err.Error()}},
			IsError: true,
		})
	}
	if direct, ok := value.(mcpToolResult); ok {
		return rpcOKResponse(req.ID, direct)
	}
	text, merr := json.Marshal(value)
	if merr != nil {
		return rpcOKResponse(req.ID, mcpToolResult{
			Content: []mcpContent{{Type: "text", Text: merr.Error()}},
			IsError: true,
		})
	}
	return rpcOKResponse(req.ID, mcpToolResult{
		Content: []mcpContent{{Type: "text", Text: string(text)}},
	})
}

func (s *Server) mcpRequireWrite() error {
	if !s.cfg.MCPWriteEnabled {
		return errors.New("MCP write operations are disabled (set MCP_WRITE_ENABLED=true to enable)")
	}
	return nil
}

// dispatchTool mirrors HandbookMcpTools.kt one-to-one.
func (s *Server) dispatchTool(r *http.Request, name string, args map[string]json.RawMessage) (any, error) {
	ctx := r.Context()
	switch name {
	case "handbook_sources":
		return s.store.SourceGetAll(ctx)

	case "handbook_item_types":
		sourceID, err := argInt64Opt(args, "sourceId")
		if err != nil {
			return nil, err
		}
		return s.store.ItemTypeGetAll(ctx, sourceID)

	case "handbook_items":
		typeID, err := argInt64(args, "typeId")
		if err != nil {
			return nil, err
		}
		limit, err := argIntDefault(args, "limit", 50)
		if err != nil {
			return nil, err
		}
		offset, err := argIntDefault(args, "offset", 0)
		if err != nil {
			return nil, err
		}
		return s.store.GetByTypeAndUser(ctx, typeID, nil, coerceIn(limit, 1, 500), coerceAtLeast(offset, 0), nil, store.ContentScope{})

	case "handbook_items_search":
		typeID, err := argInt64(args, "typeId")
		if err != nil {
			return nil, err
		}
		q, err := argString(args, "q")
		if err != nil {
			return nil, err
		}
		limit, err := argIntDefault(args, "limit", 20)
		if err != nil {
			return nil, err
		}
		return s.store.SearchByTypeAndName(ctx, typeID, q, nil, coerceIn(limit, 1, 500), 0, nil, store.ContentScope{})

	case "handbook_items_get":
		ids, err := argInt64Slice(args, "ids")
		if err != nil {
			return nil, err
		}
		return s.store.GetByIds(ctx, ids)

	case "handbook_suggest_types":
		sourceID, err := argInt64Opt(args, "sourceId")
		if err != nil {
			return nil, err
		}
		return s.store.GetAllSuggestTypes(ctx, sourceID)

	case "handbook_suggests":
		typeID, err := argInt64(args, "typeId")
		if err != nil {
			return nil, err
		}
		return s.store.GetSuggestsByType(ctx, typeID, nil)

	case "handbook_suggests_search":
		q, err := argString(args, "q")
		if err != nil {
			return nil, err
		}
		limit, err := argIntDefault(args, "limit", 20)
		if err != nil {
			return nil, err
		}
		return s.store.SearchSuggestsByName(ctx, q, nil, coerceIn(limit, 1, 100))

	case "error_reports_list":
		limit, err := argIntDefault(args, "limit", 100)
		if err != nil {
			return nil, err
		}
		offset, err := argIntDefault(args, "offset", 0)
		if err != nil {
			return nil, err
		}
		return s.store.ListApprovedErrorReports(ctx, coerceIn(limit, 1, 500), coerceAtLeast(offset, 0))

	case "error_report_lock_acquire":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		ttlMinutes, err := argIntDefault(args, "ttlMinutes", defaultErrorReportLeaseMinutes)
		if err != nil {
			return nil, err
		}
		leaseID, err := newErrorReportLeaseID()
		if err != nil {
			return nil, err
		}
		lease, acquired, err := s.store.AcquireErrorReportAutomationLease(ctx, leaseID, time.Duration(coerceIn(ttlMinutes, minErrorReportLeaseMinutes, maxErrorReportLeaseMinutes))*time.Minute)
		if err != nil {
			return nil, err
		}
		result := map[string]any{
			"acquired":  acquired,
			"expiresAt": lease.ExpiresAt,
		}
		if acquired {
			result["leaseId"] = lease.LeaseID
			result["acquiredAt"] = lease.AcquiredAt
		}
		return result, nil

	case "error_report_lock_renew":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		leaseID, err := errorReportLeaseIDArg(args)
		if err != nil {
			return nil, err
		}
		ttlMinutes, err := argIntDefault(args, "ttlMinutes", defaultErrorReportLeaseMinutes)
		if err != nil {
			return nil, err
		}
		lease, renewed, err := s.store.RenewErrorReportAutomationLease(ctx, leaseID, time.Duration(coerceIn(ttlMinutes, minErrorReportLeaseMinutes, maxErrorReportLeaseMinutes))*time.Minute)
		if err != nil {
			return nil, err
		}
		result := map[string]any{"renewed": renewed}
		if renewed {
			result["expiresAt"] = lease.ExpiresAt
		}
		return result, nil

	case "error_report_lock_release":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		leaseID, err := errorReportLeaseIDArg(args)
		if err != nil {
			return nil, err
		}
		released, err := s.store.ReleaseErrorReportAutomationLease(ctx, leaseID)
		if err != nil {
			return nil, err
		}
		return map[string]bool{"released": released}, nil

	case "error_reports_claim":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		ids, err := argInt64Slice(args, "ids")
		if err != nil {
			return nil, err
		}
		if len(ids) == 0 || len(ids) > 500 {
			return nil, errors.New("ids must contain 1..500 error report ids")
		}
		leaseID, err := errorReportLeaseIDArg(args)
		if err != nil {
			return nil, err
		}
		claim, claimed, err := s.store.ClaimApprovedErrorReports(ctx, leaseID, ids)
		if err != nil {
			return nil, err
		}
		if !claimed {
			return nil, errors.New("reports could not be claimed atomically: the lease expired or the queue changed")
		}
		return claim, nil

	case "error_report_title_set":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		id, err := argInt64(args, "id")
		if err != nil {
			return nil, err
		}
		title, err := argString(args, "title")
		if err != nil {
			return nil, err
		}
		title, err = normalizeErrorReportTitle(title)
		if err != nil {
			return nil, err
		}
		leaseID, err := errorReportLeaseIDArg(args)
		if err != nil {
			return nil, err
		}
		updated, err := s.store.SetClaimedErrorReportTitle(ctx, id, title, leaseID)
		if err != nil {
			return nil, err
		}
		if !updated {
			return nil, fmt.Errorf("claimed approved error report %d not found or lease is no longer active", id)
		}
		return map[string]any{"id": id, "title": title}, nil

	case "error_report_delete":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		id, err := argInt64(args, "id")
		if err != nil {
			return nil, err
		}
		resolution := "Завершено через устаревший MCP-инструмент error_report_delete"
		resolved, err := s.store.ResolveApprovedErrorReport(ctx, id, resolution, nil, nil)
		if err != nil {
			return nil, err
		}
		if !resolved {
			return nil, fmt.Errorf("error report %d not found", id)
		}
		return fmt.Sprintf("finished error report %d", id), nil

	case "error_report_resolve":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		id, err := argInt64(args, "id")
		if err != nil {
			return nil, err
		}
		resolution, err := argString(args, "resolution")
		if err != nil {
			return nil, err
		}
		resolution, err = normalizeErrorReportMessage(resolution)
		if err != nil {
			return nil, err
		}
		commitSHA, err := argStringOpt(args, "commitSha")
		if err != nil {
			return nil, err
		}
		commitSHA, err = normalizeErrorReportCommitSHA(commitSHA)
		if err != nil {
			return nil, err
		}
		leaseID, err := errorReportLeaseIDArgOpt(args)
		if err != nil {
			return nil, err
		}
		resolved, err := s.store.ResolveApprovedErrorReport(ctx, id, resolution, commitSHA, leaseID)
		if err != nil {
			return nil, err
		}
		if !resolved {
			return nil, fmt.Errorf("open approved error report %d not found", id)
		}
		return map[string]any{
			"id":         id,
			"status":     store.ErrorReportStatusResolved,
			"resolution": resolution,
			"commitSha":  commitSHA,
		}, nil

	case "error_report_question_create":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		id, err := argInt64(args, "id")
		if err != nil {
			return nil, err
		}
		question, err := argString(args, "question")
		if err != nil {
			return nil, err
		}
		question, err = normalizeErrorReportMessage(question)
		if err != nil {
			return nil, err
		}
		leaseID, err := errorReportLeaseIDArgOpt(args)
		if err != nil {
			return nil, err
		}
		created, err := s.store.CreateErrorReportAIQuestion(ctx, id, question, leaseID)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				return nil, fmt.Errorf("approved error report %d not found", id)
			}
			if errors.Is(err, store.ErrErrorReportAwaitingAnswer) {
				return nil, fmt.Errorf("error report %d is already awaiting an admin answer", id)
			}
			return nil, err
		}
		return created, nil

	case "error_report_serious_change_request":
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
		id, err := argInt64(args, "id")
		if err != nil {
			return nil, err
		}
		reason, err := argString(args, "reason")
		if err != nil {
			return nil, err
		}
		reason, err = normalizeErrorReportMessage(reason)
		if err != nil {
			return nil, err
		}
		leaseID, err := errorReportLeaseIDArgOpt(args)
		if err != nil {
			return nil, err
		}
		requested, err := s.store.RequestApprovedErrorReportSeriousChange(ctx, id, reason, leaseID)
		if err != nil {
			return nil, err
		}
		if !requested {
			return nil, fmt.Errorf("open approved error report %d not found or already awaiting serious-change approval", id)
		}
		return map[string]any{
			"id":                        id,
			"waitingForSeriousApproval": true,
			"seriousChangeReason":       reason,
		}, nil

	case "error_report_screenshot":
		id, err := argInt64(args, "id")
		if err != nil {
			return nil, err
		}
		kindValue, err := argStringOpt(args, "kind")
		if err != nil {
			return nil, err
		}
		kind := "element"
		if kindValue != nil && *kindValue != "" {
			kind = *kindValue
		}
		var screenshot []byte
		var contentType string
		switch kind {
		case "element":
			screenshot, contentType, err = s.store.GetApprovedErrorReportScreenshot(ctx, id)
		case "viewport":
			screenshot, contentType, err = s.store.GetApprovedErrorReportViewportScreenshot(ctx, id)
		default:
			return nil, errors.New("kind must be element or viewport")
		}
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				return nil, fmt.Errorf("screenshot for error report %d not found", id)
			}
			return nil, err
		}
		return mcpToolResult{Content: []mcpContent{
			{Type: "text", Text: fmt.Sprintf("error report %d %s screenshot", id, kind)},
			{Type: "image", Data: base64.StdEncoding.EncodeToString(screenshot), MimeType: contentType},
		}}, nil

	case "handbook_item_create":
		return s.toolItemCreate(ctx, args)
	case "handbook_item_update":
		return s.toolItemUpdate(ctx, args)
	case "handbook_item_delete":
		return s.toolItemDelete(ctx, args)
	case "handbook_suggest_create":
		return s.toolSuggestCreate(ctx, args)
	case "handbook_suggest_update":
		return s.toolSuggestUpdate(ctx, args)
	case "handbook_suggest_set_svg":
		return s.toolSuggestSetSvg(ctx, args)
	case "handbook_suggest_delete":
		return s.toolSuggestDelete(ctx, args)
	}
	return nil, fmt.Errorf("unknown tool %q", name)
}

func (s *Server) toolItemCreate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	name, err := argString(args, "name")
	if err != nil {
		return nil, err
	}
	nameEn, err := argString(args, "nameEn")
	if err != nil {
		return nil, err
	}
	dataStr, err := argString(args, "data")
	if err != nil {
		return nil, err
	}
	data, err := parseMcpData(dataStr)
	if err != nil {
		return nil, err
	}
	parentID, err := argInt64Opt(args, "parentId")
	if err != nil {
		return nil, err
	}
	return s.store.CreateBase(ctx, name, nameEn, data, typeID, parentID)
}

func (s *Server) toolItemUpdate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	name, err := argString(args, "name")
	if err != nil {
		return nil, err
	}
	nameEn, err := argStringOpt(args, "nameEn")
	if err != nil {
		return nil, err
	}
	dataStr, err := argString(args, "data")
	if err != nil {
		return nil, err
	}
	data, err := parseMcpData(dataStr)
	if err != nil {
		return nil, err
	}
	parentID, err := argInt64Opt(args, "parentId")
	if err != nil {
		return nil, err
	}
	if err := s.store.Update(ctx, id, mcpAdminUser, true, name, nameEn, data); err != nil {
		return nil, err
	}
	if parentID != nil {
		var p *int64
		if *parentID >= 0 {
			p = parentID
		}
		if err := s.store.SetParent(ctx, id, p); err != nil {
			return nil, err
		}
	}
	items, err := s.store.GetByIds(ctx, []int64{id})
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	return items[0], nil
}

func (s *Server) toolItemDelete(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	if err := s.store.Delete(ctx, id, mcpAdminUser, true); err != nil {
		return nil, err
	}
	return fmt.Sprintf("deleted item %d", id), nil
}

func (s *Server) toolSuggestCreate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	value, err := argString(args, "value")
	if err != nil {
		return nil, err
	}
	code, err := argStringOpt(args, "code")
	if err != nil {
		return nil, err
	}
	color, err := argStringOpt(args, "color")
	if err != nil {
		return nil, err
	}
	desc, err := argStringOpt(args, "desc")
	if err != nil {
		return nil, err
	}
	return s.store.AddBaseSuggest(ctx, typeID, value, code, desc, color)
}

func (s *Server) toolSuggestUpdate(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	value, err := argString(args, "value")
	if err != nil {
		return nil, err
	}
	code, err := argStringOpt(args, "code")
	if err != nil {
		return nil, err
	}
	color, err := argStringOpt(args, "color")
	if err != nil {
		return nil, err
	}
	desc, err := argStringOpt(args, "desc")
	if err != nil {
		return nil, err
	}
	old, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, fmt.Errorf("suggest id=%d type=%d not found", id, typeID)
		}
		return nil, err
	}
	if err := s.store.UpdateSuggest(ctx, id, typeID, mcpAdminUser, true, value, code, color, desc, old.SvgID); err != nil {
		return nil, err
	}
	updated, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Server) toolSuggestSetSvg(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	svg, err := argString(args, "svg")
	if err != nil {
		return nil, err
	}
	old, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, fmt.Errorf("suggest id=%d type=%d not found", id, typeID)
		}
		return nil, err
	}
	trimmed := strings.TrimSpace(svg)
	var newSvgID *int64
	if trimmed != "" {
		if !strings.Contains(strings.ToLower(trimmed), "<svg") {
			return nil, errors.New("svg must contain an <svg> element")
		}
		if len([]byte(trimmed)) > 512*1024 {
			return nil, errors.New("svg is too large (max 512 KB)")
		}
		savedID, err := s.store.SaveSuggestSvg(ctx, trimmed)
		if err != nil {
			return nil, err
		}
		newSvgID = &savedID
	}
	if err := s.store.UpdateSuggest(ctx, id, typeID, mcpAdminUser, true, old.Value, old.Code, old.Color, old.Desc, newSvgID); err != nil {
		return nil, err
	}
	if !int64PtrEqual(newSvgID, old.SvgID) && old.SvgID != nil {
		if err := s.store.DeleteSuggestSvg(ctx, *old.SvgID); err != nil {
			return nil, err
		}
	}
	updated, err := s.store.GetEditableSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Server) toolSuggestDelete(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return nil, err
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return nil, err
	}
	deleted, err := s.store.DeleteSuggest(ctx, id, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	if deleted {
		return fmt.Sprintf("deleted suggest id=%d type=%d", id, typeID), nil
	}
	return fmt.Sprintf("suggest id=%d type=%d not found", id, typeID), nil
}

// --- argument helpers ---

func rawArg(args map[string]json.RawMessage, key string) (json.RawMessage, bool) {
	v, ok := args[key]
	if !ok || len(v) == 0 || string(v) == "null" {
		return nil, false
	}
	return v, true
}

func argInt64(args map[string]json.RawMessage, key string) (int64, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return 0, fmt.Errorf("missing required parameter %q", key)
	}
	var v int64
	if err := json.Unmarshal(raw, &v); err != nil {
		return 0, fmt.Errorf("parameter %q must be an integer", key)
	}
	return v, nil
}

func argInt64Opt(args map[string]json.RawMessage, key string) (*int64, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return nil, nil
	}
	var v int64
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("parameter %q must be an integer", key)
	}
	return &v, nil
}

func argIntDefault(args map[string]json.RawMessage, key string, def int) (int, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return def, nil
	}
	var v int
	if err := json.Unmarshal(raw, &v); err != nil {
		return 0, fmt.Errorf("parameter %q must be an integer", key)
	}
	return v, nil
}

func argInt64Slice(args map[string]json.RawMessage, key string) ([]int64, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return nil, fmt.Errorf("missing required parameter %q", key)
	}
	var v []int64
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("parameter %q must be an array of integers", key)
	}
	return v, nil
}

func argString(args map[string]json.RawMessage, key string) (string, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return "", fmt.Errorf("missing required parameter %q", key)
	}
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return "", fmt.Errorf("parameter %q must be a string", key)
	}
	return v, nil
}

func argStringOpt(args map[string]json.RawMessage, key string) (*string, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return nil, nil
	}
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("parameter %q must be a string", key)
	}
	return &v, nil
}

func parseMcpData(s string) (json.RawMessage, error) {
	if strings.TrimSpace(s) == "" {
		return json.RawMessage("{}"), nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		return nil, fmt.Errorf("data must be a JSON object: %w", err)
	}
	raw, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func normalizeErrorReportCommitSHA(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}
	if len(trimmed) < 7 || len(trimmed) > 64 {
		return nil, errors.New("commitSha must contain 7..64 hexadecimal characters")
	}
	for _, char := range trimmed {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')) {
			return nil, errors.New("commitSha must contain 7..64 hexadecimal characters")
		}
	}
	return &trimmed, nil
}

// --- tools/list schema ---

func mcpToolDefs() []map[string]any {
	strP := func(desc string) map[string]any { return map[string]any{"type": "string", "description": desc} }
	intP := func(desc string) map[string]any { return map[string]any{"type": "integer", "description": desc} }
	schema := func(props map[string]any, required ...string) map[string]any {
		if required == nil {
			required = []string{}
		}
		return map[string]any{"type": "object", "properties": props, "required": required}
	}
	tool := func(name, desc string, input map[string]any) map[string]any {
		return map[string]any{"name": name, "description": desc, "inputSchema": input}
	}

	return []map[string]any{
		tool("handbook_sources",
			"List handbook systems. Returns id, name, versions [{id, sourceId, version}], countItems; version is a compatibility alias for the first edition.",
			schema(map[string]any{})),
		tool("handbook_item_types",
			"List item types (handbook object categories such as enemies, weapons). Each type's `fields` array is the schema describing which keys are allowed in an item's `data`. Read this before creating or updating items.",
			schema(map[string]any{"sourceId": intP("Optional source id to filter by")})),
		tool("handbook_items",
			"List base (shared) items of a given type, paginated.",
			schema(map[string]any{
				"typeId": intP("Item type id"),
				"limit":  intP("Max rows, 1..500 (default 50)"),
				"offset": intP("Offset for pagination (default 0)"),
			}, "typeId")),
		tool("handbook_items_search",
			"Search base (shared) items of a type by name (case-insensitive substring).",
			schema(map[string]any{
				"typeId": intP("Item type id"),
				"q":      strP("Name query"),
				"limit":  intP("Max rows, 1..500 (default 20)"),
			}, "typeId", "q")),
		tool("handbook_items_get",
			"Fetch items by their ids (any owner).",
			schema(map[string]any{
				"ids": map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "Item ids"},
			}, "ids")),
		tool("handbook_suggest_types",
			"List suggest types (dictionary categories). Returns id, name, source, color, countItems.",
			schema(map[string]any{"sourceId": intP("Optional source id to filter by")})),
		tool("handbook_suggests",
			"List base (shared) suggests (dictionary values) of a given type.",
			schema(map[string]any{"typeId": intP("Suggest type id")}, "typeId")),
		tool("handbook_suggests_search",
			"Search base (shared) suggests across all types by value (case-insensitive substring).",
			schema(map[string]any{
				"q":     strP("Value query"),
				"limit": intP("Max rows, 1..100 (default 20)"),
			}, "q")),
		tool("error_reports_list",
			"List actionable open admin-approved page error reports, newest first. Finished/unapproved reports, unanswered AI questions, and serious changes awaiting ADMIN approval are not exposed. A report becomes visible again after an answer or serious-change approval. New reports have title=null until the owning AI run analyzes and titles them. Includes full feedback history, approval/lifecycle metadata, description, page URL, selected element metadata, reporter, screenshot metadata, and creation time.",
			schema(map[string]any{
				"limit":  intP("Max rows, 1..500 (default 100)"),
				"offset": intP("Offset for pagination (default 0)"),
			})),
		tool("error_report_lock_acquire",
			"Atomically acquire the shared error-report automation lease before reading or changing reports. If acquired is false, another run is active and this run must stop. Returns a short-lived opaque leaseId handle; release it in a final cleanup step. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"ttlMinutes": intP("Lease lifetime, 5..120 minutes (default 45)"),
			})),
		tool("error_report_lock_renew",
			"Extend a still-active error-report automation lease owned by the supplied leaseId. Renew before tests, push, and deploy or whenever expiry is less than 15 minutes away. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"leaseId":    strP("Opaque handle returned by error_report_lock_acquire"),
				"ttlMinutes": intP("New lease lifetime from now, 5..120 minutes (default 45)"),
			}, "leaseId")),
		tool("error_report_lock_release",
			"Release the shared error-report automation lease. Always call this in the run's final cleanup step, including when no approved reports exist. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"leaseId": strP("Opaque handle returned by error_report_lock_acquire"),
			}, "leaseId")),
		tool("error_reports_claim",
			"Atomically mark a batch from the current actionable queue as IN_PROGRESS for the active automation lease. Claimed reports disappear from error_reports_list, remain visible to reviewers as 'В работе', and return to OPEN if the lease expires or is released before completion. Call immediately after the post-lock error_reports_list and before reading project context.",
			schema(map[string]any{
				"ids":     map[string]any{"type": "array", "items": map[string]any{"type": "integer"}, "description": "All actionable report ids from the post-lock list, 1..500"},
				"leaseId": strP("Opaque handle returned by error_report_lock_acquire"),
			}, "ids", "leaseId")),
		tool("error_report_title_set",
			"Set a concise diagnostic title after the AI has inspected a claimed report. New reports intentionally have title=null; call this once the symptom is understood. Only the active lease that owns the IN_PROGRESS report can set it.",
			schema(map[string]any{
				"id":      intP("Claimed error report id"),
				"title":   strP("Concise diagnostic title in Russian, 1..160 characters"),
				"leaseId": strP("Opaque handle that owns the IN_PROGRESS report"),
			}, "id", "title", "leaseId")),
		tool("error_report_delete",
			"Deprecated compatibility alias: mark one open approved report as finished instead of physically deleting it. Prefer error_report_resolve so the resolution and commit can be recorded. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"id": intP("Error report id"),
			}, "id")),
		tool("error_report_resolve",
			"Mark one successfully fixed open approved report as finished. Records a concise resolution and optional deployed commit SHA; the report remains visible to reviewers for one hour before automatic archival and is removed from the actionable MCP queue. Call only after successful tests, push, and deploy. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"id":         intP("Error report id"),
				"resolution": strP("Concise root cause and deployed fix, 1..4000 characters"),
				"commitSha":  strP("Optional deployed Git commit SHA, 7..64 hexadecimal characters"),
				"leaseId":    strP("Lease that owns an IN_PROGRESS report; optional only for legacy OPEN reports"),
			}, "id", "resolution")),
		tool("error_report_question_create",
			"Ask an admin a question when an approved error report cannot be handled confidently. After this call the report is hidden from error_reports_list until an admin answers. Ask one concrete question that explains exactly which missing fact or decision blocks the fix. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"id":       intP("Error report id"),
				"question": strP("Concrete question for the administrator, 1..4000 characters"),
				"leaseId":  strP("Lease that owns an IN_PROGRESS report; optional only for legacy OPEN reports"),
			}, "id", "question")),
		tool("error_report_serious_change_request",
			"Pause an approved report because the proposed fix changes schema, authorization, security, data semantics, infrastructure, or another high-impact area that requires explicit ADMIN approval. The report is hidden from error_reports_list until an ADMIN confirms it in the application. Use a normal question instead when only product context is missing. Requires MCP write operations to be enabled.",
			schema(map[string]any{
				"id":      intP("Error report id"),
				"reason":  strP("Concrete proposed high-impact change, risks, and why ADMIN approval is required, 1..4000 characters"),
				"leaseId": strP("Lease that owns an IN_PROGRESS report; optional only for legacy OPEN reports"),
			}, "id", "reason")),
		tool("error_report_screenshot",
			"Fetch an attached screenshot for one admin-approved page error report as native MCP image content. kind=element returns the selected-element crop; kind=viewport returns the visible page context. Check hasScreenshot/hasViewportScreenshot first.",
			schema(map[string]any{
				"id":   intP("Error report id"),
				"kind": strP("Optional screenshot kind: element (default) or viewport"),
			}, "id")),
		tool("handbook_item_create",
			"Create a base (shared, user_id=null) item. Use handbook_item_types first to learn the `data` schema for the given typeId.",
			schema(map[string]any{
				"typeId":   intP("Item type id"),
				"name":     strP("Display name (Russian)"),
				"nameEn":   strP("English name"),
				"data":     strP("JSON object string with the item data matching the type's fields schema"),
				"parentId": intP("Parent item id for a variant/sub-entity (subrace -> race item, subclass -> class item). Omit for base items."),
			}, "typeId", "name", "nameEn", "data")),
		tool("handbook_item_update",
			"Update an item by id (admin: works for any owner including base items).",
			schema(map[string]any{
				"id":       intP("Item id"),
				"name":     strP("Display name (Russian)"),
				"nameEn":   strP("English name"),
				"data":     strP("JSON object string with the full item data"),
				"parentId": intP("Parent item id for a variant/sub-entity (subrace -> race item, subclass -> class item). Pass -1 to clear the link; omit to leave it unchanged."),
			}, "id", "name", "data")),
		tool("handbook_item_delete",
			"Delete an item by id (admin: works for any owner including base items).",
			schema(map[string]any{"id": intP("Item id")}, "id")),
		tool("handbook_suggest_create",
			"Create a base (shared, user_id=null) suggest in the given type.",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"value":  strP("Display value"),
				"code":   strP("Optional code/key"),
				"color":  strP("Optional hex color"),
				"desc":   strP("Optional description/tooltip"),
			}, "typeId", "value")),
		tool("handbook_suggest_update",
			"Update a suggest by id+typeId (admin: works for any owner including base). Preserves the existing svg icon.",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"id":     intP("Suggest id"),
				"value":  strP("Display value"),
				"code":   strP("Optional code/key"),
				"color":  strP("Optional hex color"),
				"desc":   strP("Optional description/tooltip"),
			}, "typeId", "id", "value")),
		tool("handbook_suggest_set_svg",
			"Set or replace the svg icon of a suggest by id+typeId (admin: works for any owner including base). Pass raw <svg> markup; an empty string clears the icon. Stores the markup in svg_storage, repoints the suggest, and removes the previous svg row.",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"id":     intP("Suggest id"),
				"svg":    strP("Raw SVG markup (e.g. <svg ...>...</svg>); empty string clears the icon"),
			}, "typeId", "id", "svg")),
		tool("handbook_suggest_delete",
			"Delete a suggest by id+typeId (admin: works for any owner including base).",
			schema(map[string]any{
				"typeId": intP("Suggest type id"),
				"id":     intP("Suggest id"),
			}, "typeId", "id")),
	}
}

func newErrorReportLeaseID() (string, error) {
	data := make([]byte, 16)
	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("generate error-report lease id: %w", err)
	}
	return hex.EncodeToString(data), nil
}

func errorReportLeaseIDArg(args map[string]json.RawMessage) (string, error) {
	if _, ok := args["leaseId"]; ok {
		return argString(args, "leaseId")
	}
	// Compatibility for an already-running client during the rolling deploy.
	return argString(args, "token")
}

func errorReportLeaseIDArgOpt(args map[string]json.RawMessage) (*string, error) {
	if _, ok := args["leaseId"]; ok {
		return argStringOpt(args, "leaseId")
	}
	if _, ok := args["token"]; ok {
		return argStringOpt(args, "token")
	}
	return nil, nil
}
