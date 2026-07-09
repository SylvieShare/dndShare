package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// JobRun — строка dndshare.job_run (порт JobRun + JobRunRepository).
type JobRun struct {
	ID              int64           `json:"id"`
	Code            string          `json:"code"`
	Name            string          `json:"name"`
	Status          string          `json:"status"`
	Current         int64           `json:"current"`
	Total           *int64          `json:"total,omitempty"`
	Message         *string         `json:"message,omitempty"`
	Error           *string         `json:"error,omitempty"`
	Result          json.RawMessage `json:"result,omitempty"`
	StartedByUserID int64           `json:"startedByUserId"`
	StartedAt       time.Time       `json:"startedAt"`
	FinishedAt      *time.Time      `json:"finishedAt,omitempty"`
}

const jobRunCols = `id, code, name, status, current_value, total_value, message, "error", "result", started_by_user_id, started_at, finished_at`

func scanJobRun(row pgx.Row) (JobRun, error) {
	var j JobRun
	var result *string
	err := row.Scan(&j.ID, &j.Code, &j.Name, &j.Status, &j.Current, &j.Total, &j.Message, &j.Error, &result, &j.StartedByUserID, &j.StartedAt, &j.FinishedAt)
	if err != nil {
		return JobRun{}, err
	}
	if result != nil {
		j.Result = json.RawMessage(*result)
	}
	return j, nil
}

// CreateJobRun создаёт запись RUNNING и возвращает её.
func (s *Store) CreateJobRun(ctx context.Context, code, name string, userID int64) (JobRun, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.job_run (code, name, status, started_by_user_id, started_at)
		 VALUES ($1, $2, 'RUNNING', $3, now()) RETURNING id`,
		code, name, userID,
	).Scan(&id)
	if err != nil {
		return JobRun{}, err
	}
	return s.GetJobRun(ctx, id)
}

// GetJobRun возвращает джоб-ран по id (ErrNotFound, если нет).
func (s *Store) GetJobRun(ctx context.Context, id int64) (JobRun, error) {
	j, err := scanJobRun(s.pool.QueryRow(ctx, `SELECT `+jobRunCols+` FROM dndshare.job_run WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return JobRun{}, ErrNotFound
	}
	return j, err
}

// RecentJobRuns — последние джоб-раны.
func (s *Store) RecentJobRuns(ctx context.Context, limit int) ([]JobRun, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+jobRunCols+` FROM dndshare.job_run ORDER BY started_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []JobRun
	for rows.Next() {
		j, err := scanJobRun(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

// ExistsRunningJobByCode — есть ли уже RUNNING джоба с таким кодом.
func (s *Store) ExistsRunningJobByCode(ctx context.Context, code string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare.job_run WHERE code = $1 AND status = 'RUNNING')`, code,
	).Scan(&exists)
	return exists, err
}

// UpdateJobProgress обновляет прогресс джобы.
func (s *Store) UpdateJobProgress(ctx context.Context, id, current int64, total *int64, message *string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.job_run SET current_value = $2, total_value = $3, message = $4 WHERE id = $1`,
		id, current, total, message,
	)
	return err
}

// FinishJobRun завершает джобу с финальным статусом.
func (s *Store) FinishJobRun(ctx context.Context, id int64, status string, current int64, total *int64, message, errMsg *string, result json.RawMessage) error {
	var res *string
	if len(result) > 0 {
		str := string(result)
		res = &str
	}
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.job_run
		 SET status = $2, current_value = $3, total_value = $4, message = $5, "error" = $6, "result" = $7::jsonb, finished_at = now()
		 WHERE id = $1`,
		id, status, current, total, message, errMsg, res,
	)
	return err
}

// MarkRunningJobsFailedAtBoot гасит зависшие RUNNING-джобы после рестарта.
func (s *Store) MarkRunningJobsFailedAtBoot(ctx context.Context, reason string) (int64, error) {
	tag, err := s.pool.Exec(ctx,
		`UPDATE dndshare.job_run SET status = 'FAILED', "error" = $1, finished_at = now() WHERE status = 'RUNNING'`,
		reason,
	)
	return tag.RowsAffected(), err
}
