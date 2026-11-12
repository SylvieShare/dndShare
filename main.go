package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"dndshare/internal/config"
	"dndshare/internal/storage"
	"dndshare/internal/store"
	"dndshare/internal/web"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("dndshare ")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(ctx, cfg.DSN, cfg.PoolMaxConns)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer st.Close()
	if n, err := st.DeleteExpiredSessions(ctx); err != nil {
		log.Printf("delete expired sessions: %v", err)
	} else if n > 0 {
		log.Printf("deleted %d expired sessions", n)
	}

	// После старта гасим админ-джобы, зависшие в RUNNING после рестарта (аналог @PostConstruct).
	if cfg.DeploymentCandidate {
		log.Printf("deployment candidate: job recovery waits for the previous instance to stop")
	} else if n, err := st.MarkRunningJobsFailedAtBoot(ctx, "Прервано рестартом приложения"); err != nil {
		log.Printf("mark running jobs failed at boot: %v", err)
	} else if n > 0 {
		log.Printf("marked %d interrupted jobs as FAILED on boot", n)
	}

	s3 := storage.New(cfg.Storage)
	app := web.New(cfg, st, s3)

	srv := &http.Server{
		Addr:              net.JoinHostPort(cfg.Host, cfg.Port),
		Handler:           app.Handler(),
		ReadHeaderTimeout: 15 * time.Second,
		// ReadTimeout щедрый: аплоады треков до 50 МБ. WriteTimeout закрывает медленных
		// читателей, IdleTimeout — простаивающие keep-alive соединения (защита от slowloris).
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("http: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("shutting down")
	app.BeginDrain()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
		_ = srv.Close()
	}
	if err := app.WaitForJobs(shutdownCtx); err != nil {
		log.Printf("job shutdown: %v", err)
	}
}
