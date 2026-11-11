package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) listErrorReportMessages(ctx context.Context, reportIDs []int64) ([]ErrorReportMessage, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT m.id, m.error_report_id, m.sender, m.message, m.admin_user_id, u.login, m.created_at
		FROM dndshare.error_report_message m
		LEFT JOIN dndshare.users u ON u.id = m.admin_user_id
		WHERE m.error_report_id = ANY($1::bigint[])
		ORDER BY m.error_report_id, m.id`, reportIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]ErrorReportMessage, 0)
	for rows.Next() {
		var message ErrorReportMessage
		if err := rows.Scan(
			&message.ID,
			&message.ErrorReportID,
			&message.Sender,
			&message.Message,
			&message.AdminUserID,
			&message.AdminUserLogin,
			&message.CreatedAt,
		); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, rows.Err()
}

func (s *Store) CreateErrorReportAIQuestion(ctx context.Context, reportID int64, message string, leaseID *string) (ErrorReportMessage, error) {
	return s.createErrorReportMessage(ctx, reportID, ErrorReportMessageSenderAI, message, nil, true, leaseID)
}

func (s *Store) CreateErrorReportAdminAnswer(ctx context.Context, reportID, adminUserID int64, message string) (ErrorReportMessage, error) {
	return s.createErrorReportMessage(ctx, reportID, ErrorReportMessageSenderAdmin, message, &adminUserID, false, nil)
}

func (s *Store) createErrorReportMessage(ctx context.Context, reportID int64, sender, message string, adminUserID *int64, requireApproved bool, leaseID *string) (ErrorReportMessage, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return ErrorReportMessage{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var approved bool
	var status string
	var processingRunID *string
	var latestSender string
	err = tx.QueryRow(ctx, `
		SELECT er.approved, er.status, er.processing_run_id, COALESCE((
		    SELECT m.sender
		    FROM dndshare.error_report_message m
		    WHERE m.error_report_id = er.id
		    ORDER BY m.id DESC
		    LIMIT 1
		), '')
		FROM dndshare.error_report er
		WHERE er.id = $1
		FOR UPDATE`, reportID).Scan(&approved, &status, &processingRunID, &latestSender)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrorReportMessage{}, ErrNotFound
	}
	if err != nil {
		return ErrorReportMessage{}, err
	}
	if requireApproved && !approved {
		return ErrorReportMessage{}, ErrNotFound
	}
	if sender == ErrorReportMessageSenderAdmin && status != ErrorReportStatusOpen {
		return ErrorReportMessage{}, ErrNotFound
	}
	if sender == ErrorReportMessageSenderAI {
		owned := status == ErrorReportStatusOpen && leaseID == nil
		if status == ErrorReportStatusInProgress && leaseID != nil && processingRunID != nil && *processingRunID == errorReportProcessingRunID(*leaseID) {
			var active bool
			if err := tx.QueryRow(ctx, `
				SELECT EXISTS (
				    SELECT 1 FROM dndshare.error_report_automation_lock
				    WHERE id = 1 AND token = $1 AND expires_at > now()
				)`, *leaseID).Scan(&active); err != nil {
				return ErrorReportMessage{}, err
			}
			owned = active
		}
		if !owned {
			return ErrorReportMessage{}, ErrNotFound
		}
	}
	if sender == ErrorReportMessageSenderAI && latestSender == ErrorReportMessageSenderAI {
		return ErrorReportMessage{}, ErrErrorReportAwaitingAnswer
	}
	if sender == ErrorReportMessageSenderAdmin && latestSender != ErrorReportMessageSenderAI {
		return ErrorReportMessage{}, ErrErrorReportNotAwaitingAnswer
	}

	var created ErrorReportMessage
	err = tx.QueryRow(ctx, `
		INSERT INTO dndshare.error_report_message (error_report_id, sender, message, admin_user_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, error_report_id, sender, message, admin_user_id, created_at`,
		reportID, sender, message, adminUserID,
	).Scan(
		&created.ID,
		&created.ErrorReportID,
		&created.Sender,
		&created.Message,
		&created.AdminUserID,
		&created.CreatedAt,
	)
	if err != nil {
		return ErrorReportMessage{}, err
	}
	if sender == ErrorReportMessageSenderAI {
		if _, err := tx.Exec(ctx, `
			UPDATE dndshare.error_report
			SET status = 'OPEN', processing_run_id = NULL,
			    processing_started_at = NULL, processing_expires_at = NULL
			WHERE id = $1`, reportID); err != nil {
			return ErrorReportMessage{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return ErrorReportMessage{}, err
	}
	return created, nil
}
