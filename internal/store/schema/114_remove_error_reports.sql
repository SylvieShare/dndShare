-- Remove the retired page-report feature and its dedicated roles.
DROP TABLE dndshare.error_report_message;
DROP TABLE dndshare.error_report;
DROP TABLE dndshare.error_report_automation_lock;

DELETE FROM dndshare.users_role
WHERE role_id IN (SELECT id FROM dndshare."role" WHERE name IN ('ERROR_REPORT_AUTO_APPROVE', 'ERROR_REPORT_REVIEWER'));
DELETE FROM dndshare."role" WHERE name IN ('ERROR_REPORT_AUTO_APPROVE', 'ERROR_REPORT_REVIEWER');
