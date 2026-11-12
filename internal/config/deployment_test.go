package config

import "testing"

func TestDeploymentEnvironment(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("DEPLOYMENT_CANDIDATE", "true")
	t.Setenv("DB_POOL_MAX_CONNS", "3")
	cfg, err := Load()
	if err != nil || !cfg.DeploymentCandidate || cfg.PoolMaxConns != 3 {
		t.Fatalf("invalid deployment config: %v", err)
	}
	t.Setenv("DB_POOL_MAX_CONNS", "0")
	if _, err := Load(); err == nil {
		t.Fatal("invalid pool limit accepted")
	}
}
