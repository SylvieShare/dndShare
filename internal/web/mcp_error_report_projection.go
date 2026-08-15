package web

import (
	"encoding/json"
	"time"

	"dndshare/internal/store"
)

// compactErrorReport keeps every field needed for diagnosis while omitting
// queue/workflow fields that are fixed by ListApprovedErrorReports.
type compactErrorReport struct {
	ID                      int64                      `json:"id"`
	Title                   *string                    `json:"title"`
	Description             string                     `json:"description"`
	PageURL                 string                     `json:"pageUrl"`
	Element                 json.RawMessage            `json:"element"`
	UserLogin               *string                    `json:"userLogin"`
	HasScreenshot           bool                       `json:"hasScreenshot"`
	HasViewportScreenshot   bool                       `json:"hasViewportScreenshot"`
	Messages                []store.ErrorReportMessage `json:"messages"`
	SeriousChangeReason     *string                    `json:"seriousChangeReason,omitempty"`
	SeriousChangeApprovedAt *time.Time                 `json:"seriousChangeApprovedAt,omitempty"`
	SeriousChangeApprovedBy *string                    `json:"seriousChangeApprovedByLogin,omitempty"`
	CreatedAt               time.Time                  `json:"createdAt"`
}

type compactErrorReportList struct {
	IDs     []int64              `json:"ids"`
	Reports []compactErrorReport `json:"reports"`
}

func newCompactErrorReportList(reports []store.ErrorReport) compactErrorReportList {
	result := compactErrorReportList{
		IDs:     make([]int64, 0, len(reports)),
		Reports: make([]compactErrorReport, 0, len(reports)),
	}
	for _, report := range reports {
		result.IDs = append(result.IDs, report.ID)
		result.Reports = append(result.Reports, compactErrorReport{
			ID:                      report.ID,
			Title:                   report.Title,
			Description:             report.Description,
			PageURL:                 report.PageURL,
			Element:                 report.Element,
			UserLogin:               report.UserLogin,
			HasScreenshot:           report.HasScreenshot,
			HasViewportScreenshot:   report.HasViewportScreenshot,
			Messages:                nonNil(report.Messages),
			SeriousChangeReason:     report.SeriousChangeReason,
			SeriousChangeApprovedAt: report.SeriousChangeApprovedAt,
			SeriousChangeApprovedBy: report.SeriousChangeApprovedByLogin,
			CreatedAt:               report.CreatedAt,
		})
	}
	return result
}
