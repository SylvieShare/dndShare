package web

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"runtime/debug"
	"sync"
	"sync/atomic"
	"time"
)

// Порт AdminJobService/JobContext: реестр админ-джоб, фоновый запуск в горутинах,
// прогресс с троттлингом флаша в БД, кооперативная отмена.

const (
	jobRunning   = "RUNNING"
	jobSuccess   = "SUCCESS"
	jobFailed    = "FAILED"
	jobCancelled = "CANCELLED"
)

// jobMeta — описание доступной джобы (порт JobMeta).
type jobMeta struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// jobFn — тело джобы. Возвращает ошибку → FAILED; errJobCancelled → CANCELLED.
type jobFn func(s *Server, jc *JobContext) error

type jobDef struct {
	meta jobMeta
	fn   jobFn
}

// jobDefs — реестр джоб (файлы-джобы регистрируются через registerJob в init()).
var jobDefs []jobDef

func registerJob(code, name, description string, fn jobFn) {
	jobDefs = append(jobDefs, jobDef{jobMeta{code, name, description}, fn})
}

var errJobCancelled = errors.New("job cancelled")

// errJobAlreadyRunning — джоба с таким кодом уже выполняется (маппится в 409, не в 500).
var errJobAlreadyRunning = errors.New("job already running")

// JobContext — прогресс и отмена одной джобы (порт JobContext).
type JobContext struct {
	server  *Server
	runID   int64
	cancel  *atomic.Bool
	current atomic.Int64
	mu      sync.Mutex
	total   *int64
	message *string
	result  any
	flush   func(current int64, total *int64, message *string)
}

// Server даёт джобе доступ к стору и т.п.
func (jc *JobContext) Server() *Server { return jc.server }

func (jc *JobContext) SetTotal(v int64) {
	jc.mu.Lock()
	jc.total = &v
	jc.mu.Unlock()
	jc.emit()
}

func (jc *JobContext) Progress(v int64, message string) {
	jc.current.Store(v)
	if message != "" {
		jc.mu.Lock()
		jc.message = &message
		jc.mu.Unlock()
	}
	jc.emit()
}

func (jc *JobContext) Increment(delta int64, message string) {
	jc.current.Add(delta)
	if message != "" {
		jc.mu.Lock()
		jc.message = &message
		jc.mu.Unlock()
	}
	jc.emit()
}

func (jc *JobContext) SetResult(v any) { jc.result = v }

func (jc *JobContext) IsCancelled() bool { return jc.cancel.Load() }

func (jc *JobContext) CheckCancelled() error {
	if jc.cancel.Load() {
		return errJobCancelled
	}
	return nil
}

func (jc *JobContext) snapshot() (int64, *int64, *string) {
	jc.mu.Lock()
	defer jc.mu.Unlock()
	return jc.current.Load(), jc.total, jc.message
}

func (jc *JobContext) emit() {
	c, t, m := jc.snapshot()
	jc.flush(c, t, m)
}

type activeJob struct {
	runID  int64
	code   string
	cancel *atomic.Bool

	mu             sync.Mutex
	lastFlush      time.Time
	flushedCurrent int64
	flushedTotal   *int64
	flushedMessage *string
}

// jobRunner — сервис запуска джоб (порт AdminJobService).
type jobRunner struct {
	server   *Server
	registry map[string]jobDef
	order    []string

	mu     sync.Mutex
	active map[int64]*activeJob
}

func newJobRunner(s *Server) *jobRunner {
	r := &jobRunner{
		server:   s,
		registry: map[string]jobDef{},
		active:   map[int64]*activeJob{},
	}
	for _, d := range jobDefs {
		r.registry[d.meta.Code] = d
		r.order = append(r.order, d.meta.Code)
	}
	return r
}

// isCodeActiveLocked — есть ли уже активная (в этом процессе) джоба с таким кодом. Вызывать под r.mu.
func (r *jobRunner) isCodeActiveLocked(code string) bool {
	for _, a := range r.active {
		if a.code == code {
			return true
		}
	}
	return false
}

func (r *jobRunner) listAvailable() []jobMeta {
	out := make([]jobMeta, 0, len(r.order))
	for _, code := range r.order {
		out = append(out, r.registry[code].meta)
	}
	return out
}

func (r *jobRunner) start(ctx context.Context, code string, userID int64) (any, bool, error) {
	def, ok := r.registry[code]
	if !ok {
		return nil, false, nil // неизвестный код
	}
	// Держим лок на всём check-then-create, чтобы два параллельных старта одного кода не
	// запустили мутирующую джобу дважды (в оригинале старт был @Synchronized).
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.isCodeActiveLocked(code) {
		return nil, true, errJobAlreadyRunning
	}
	running, err := r.server.store.ExistsRunningJobByCode(ctx, code)
	if err != nil {
		return nil, true, err
	}
	if running {
		return nil, true, errJobAlreadyRunning
	}
	run, err := r.server.store.CreateJobRun(ctx, code, def.meta.Name, userID)
	if err != nil {
		return nil, true, err
	}

	cancel := &atomic.Bool{}
	a := &activeJob{runID: run.ID, code: code, cancel: cancel, flushedCurrent: -1}
	r.active[run.ID] = a

	jc := &JobContext{
		server: r.server,
		runID:  run.ID,
		cancel: cancel,
		flush: func(current int64, total *int64, message *string) {
			r.onProgress(a, current, total, message)
		},
	}

	go r.run(def, jc, a)
	return run, true, nil
}

func (r *jobRunner) run(def jobDef, jc *JobContext, a *activeJob) {
	bg := context.Background()
	defer func() {
		r.mu.Lock()
		delete(r.active, a.runID)
		r.mu.Unlock()
	}()

	err := func() (e error) {
		defer func() {
			if v := recover(); v != nil {
				e = fmt.Errorf("panic: %v\n%s", v, debug.Stack())
			}
		}()
		return def.fn(r.server, jc)
	}()

	current, total, message := jc.snapshot()
	var finishErr error
	switch {
	case err == nil:
		var result json.RawMessage
		if jc.result != nil {
			if b, mErr := json.Marshal(jc.result); mErr == nil {
				result = b
			}
		}
		finishErr = r.server.store.FinishJobRun(bg, a.runID, jobSuccess, current, total, message, nil, result)
	case errors.Is(err, errJobCancelled):
		finishErr = r.server.store.FinishJobRun(bg, a.runID, jobCancelled, current, total, message, nil, nil)
	default:
		errStr := err.Error()
		if len(errStr) > 2000 {
			errStr = errStr[:2000]
		}
		finishErr = r.server.store.FinishJobRun(bg, a.runID, jobFailed, current, total, message, &errStr, nil)
	}
	if finishErr != nil {
		// Если финальный UPDATE не прошёл, джоба останется RUNNING до перезапуска (там её
		// подчистит MarkRunningJobsFailedAtBoot). Логируем, чтобы это было диагностируемо.
		log.Printf("finish job run %d: %v", a.runID, finishErr)
	}
}

func (r *jobRunner) cancel(id int64) bool {
	r.mu.Lock()
	a := r.active[id]
	r.mu.Unlock()
	if a == nil {
		return false
	}
	a.cancel.Store(true)
	return true
}

const jobFlushInterval = 500 * time.Millisecond

func (r *jobRunner) onProgress(a *activeJob, current int64, total *int64, message *string) {
	a.mu.Lock()
	changed := current != a.flushedCurrent || !int64PtrEqual(total, a.flushedTotal) || !strPtrEqual(message, a.flushedMessage)
	if !changed {
		a.mu.Unlock()
		return
	}
	if !a.lastFlush.IsZero() && time.Since(a.lastFlush) < jobFlushInterval {
		a.mu.Unlock()
		return
	}
	a.lastFlush = time.Now()
	a.flushedCurrent = current
	a.flushedTotal = total
	a.flushedMessage = message
	a.mu.Unlock()

	if err := r.server.store.UpdateJobProgress(context.Background(), a.runID, current, total, message); err != nil {
		log.Printf("job progress %d: %v", a.runID, err)
	}
}

func int64PtrEqual(a, b *int64) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func strPtrEqual(a, b *string) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}
