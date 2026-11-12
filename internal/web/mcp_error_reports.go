package web

import (
	"dndshare/internal/store"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

const (
	defaultErrorReportLeaseMinutes = 45
	minErrorReportLeaseMinutes     = 5
	maxErrorReportLeaseMinutes     = 120
)

type errorReportListProbe struct {
	HasReports bool `json:"hasReports"`
}

func newErrorReportListProbe(hasReports bool) errorReportListProbe {
	return errorReportListProbe{HasReports: hasReports}
}
func (s *Server) dispatchErrorReportTool(r *http.Request, name string, args map[string]json.RawMessage) (any, error) {
	ctx := r.Context()
	switch name {
	case "error_report_get":
		id, err := argInt64(args, "id")
		if err != nil {
			return nil, err
		}
		return s.store.GetApprovedErrorReport(ctx, id)
	case "error_reports_list":
		summaryOnly, err := argBoolDefault(args, "summaryOnly", false)
		if err != nil {
			return nil, err
		}
		compact, err := argBoolDefault(args, "compact", false)
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
		if summaryOnly {
			hasReports, err := s.store.HasApprovedErrorReports(ctx)
			if err != nil {
				return nil, err
			}
			return newErrorReportListProbe(hasReports), nil
		}
		reports, err := s.store.ListApprovedErrorReports(ctx, coerceIn(limit, 1, 500), coerceAtLeast(offset, 0))
		if err != nil {
			return nil, err
		}
		if compact {
			return newCompactErrorReportList(reports), nil
		}
		return nonNil(reports), nil

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

	default:
		return nil, fmt.Errorf("unknown error report tool: %s", name)
	}
}
