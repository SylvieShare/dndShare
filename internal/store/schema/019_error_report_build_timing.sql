ALTER TABLE dndshare.error_report_work_interval
    DROP CONSTRAINT error_report_work_interval_phase_check;
ALTER TABLE dndshare.error_report_work_interval
    ADD CONSTRAINT error_report_work_interval_phase_check
    CHECK (phase IN ('analysis', 'fix', 'test', 'build', 'deploy'));

-- Existing test intervals include release preparation. Their durations stay intact.
-- New writers explicitly mark that build time is measured separately.
ALTER TABLE dndshare.error_report_work_interval
    ADD COLUMN separate_build boolean NOT NULL DEFAULT false;
