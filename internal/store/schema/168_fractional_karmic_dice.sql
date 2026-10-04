ALTER TABLE dndshare.session_karmic_scale
    ALTER COLUMN balance TYPE numeric(3,1) USING balance::numeric(3,1);
