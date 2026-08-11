package web

import (
	"crypto/subtle"
	"encoding/base64"
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

type errorReportListProbe struct {
	HasReports bool `json:"hasReports"`
}

func newErrorReportListProbe(reports []store.ErrorReport) errorReportListProbe {
	return errorReportListProbe{HasReports: len(reports) > 0}
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
		summaryOnly, err := argBoolDefault(args, "summaryOnly", false)
		if err != nil {
			return nil, err
		}
		limit, err := argIntDefault(args, "limit", 100)
		if err != nil {
			return nil, err
		}
		offset, err := argIntDefault(args, "offset", 0)
		if err != nil {
			return nil, err
		}
		reports, err := s.store.ListApprovedErrorReports(ctx, coerceIn(limit, 1, 500), coerceAtLeast(offset, 0))
		if err != nil {
			return nil, err
		}
		if summaryOnly {
			return newErrorReportListProbe(reports), nil
		}
		return reports, nil

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
		leaseID, err := errorReportLeaseIDArg(args)
		if err != nil {
			return nil, err
		}
		resolved, err := s.store.ResolveApprovedErrorReport(ctx, id, resolution, commitSHA, &leaseID)
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
		leaseID, err := errorReportLeaseIDArg(args)
		if err != nil {
			return nil, err
		}
		created, err := s.store.CreateErrorReportAIQuestion(ctx, id, question, &leaseID)
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
		leaseID, err := errorReportLeaseIDArg(args)
		if err != nil {
			return nil, err
		}
		requested, err := s.store.RequestApprovedErrorReportSeriousChange(ctx, id, reason, &leaseID)
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
