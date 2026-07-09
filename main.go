package main

import (
	"context"
	"errors"
	"log"
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

	st, err := store.Open(ctx, cfg.DSN)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer st.Close()

	// После старта гасим админ-джобы, зависшие в RUNNING после рестарта (аналог @PostConstruct).
	if n, err := st.MarkRunningJobsFailedAtBoot(ctx, "Прервано рестартом приложения"); err != nil {
		log.Printf("mark running jobs failed at boot: %v", err)
	} else if n > 0 {
		log.Printf("marked %d interrupted jobs as FAILED on boot", n)
	}

	s3 := storage.New(cfg.Storage)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           web.New(cfg, st, s3).Handler(),
		ReadHeaderTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("http: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
