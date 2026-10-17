-- Move the embedded handbook media to content-addressed S3 WebP objects.
-- Upload and verify scripts/static-media before deploying this migration.
-- Preserve image IDs (including shared references), deleted flags, and media types.
-- Replaced artwork has a different URL and is deliberately left untouched.
WITH media(legacy_key, legacy_url, object_key, file_name, file_size) AS (
  VALUES
    ('static-handbook-type-icons/v1/1-weapons.png', '/static/handbook-types/1-weapons.png', 'system-item-media/v1/static/handbook-types/1-weapons/04d50867d2e300ce43520409f95c772d311de1fe9d338117e7327c73db776ad4.webp', '1-weapons.webp', 43136::bigint),
    ('static-handbook-type-icons/v1/10-potions.png', '/static/handbook-types/10-potions.png', 'system-item-media/v1/static/handbook-types/10-potions/21ca892639a71daba5ca564f708a8ccd13cc9793959c0581cc4b331dc061370f.webp', '10-potions.webp', 38682::bigint),
    ('static-handbook-type-icons/v1/11-backgrounds.png', '/static/handbook-types/11-backgrounds.png', 'system-item-media/v1/static/handbook-types/11-backgrounds/0cd3c5c9eb1a0759178ec3e0bd0d5043c139b82c908cb4ad7479b0c86b4b0acb.webp', '11-backgrounds.webp', 52222::bigint),
    ('static-handbook-type-icons/v1/12-armor.png', '/static/handbook-types/12-armor.png', 'system-item-media/v1/static/handbook-types/12-armor/a9ab2ec52fab623d68a0fe40e4d4fef66e32a38db4d30217ea7312c4ffee2c63.webp', '12-armor.webp', 43314::bigint),
    ('static-handbook-type-icons/v1/13-transport.png', '/static/handbook-types/13-transport.png', 'system-item-media/v1/static/handbook-types/13-transport/ae018a97c87199a6c60439e0e70b26b431a178b324dbda282693f99cfeaa8626.webp', '13-transport.webp', 58616::bigint),
    ('static-handbook-type-icons/v1/2-items.png', '/static/handbook-types/2-items.png', 'system-item-media/v1/static/handbook-types/2-items/2e999d398260ccbe5237512f41f90a87fb1c94c87d8da40844d16083c57df411.webp', '2-items.webp', 49816::bigint),
    ('static-handbook-type-icons/v1/3-racial-abilities.png', '/static/handbook-types/3-racial-abilities.png', 'system-item-media/v1/static/handbook-types/3-racial-abilities/37eabdf8b6cbda2f047045b55f9d766f06b840a0636d615a39541eb67493679a.webp', '3-racial-abilities.webp', 43898::bigint),
    ('static-handbook-type-icons/v1/4-class-abilities.png', '/static/handbook-types/4-class-abilities.png', 'system-item-media/v1/static/handbook-types/4-class-abilities/219afbd8e15f7eb9d5a2387e2624a4bcb16185164384081e97c93d91c9abfaef.webp', '4-class-abilities.webp', 48904::bigint),
    ('static-handbook-type-icons/v1/5-spells.png', '/static/handbook-types/5-spells.png', 'system-item-media/v1/static/handbook-types/5-spells/3a673f80e5bed044adc3e624614a1f8c6c3406ca64c08ece80c77b839dfcee2c.webp', '5-spells.webp', 38440::bigint),
    ('static-handbook-type-icons/v1/6-bestiary.png', '/static/handbook-types/6-bestiary.png', 'system-item-media/v1/static/handbook-types/6-bestiary/31ca7e22537bfc08bb24b38b3bcc8b0312bf9a0ce570ddb73ee36fc4782e442a.webp', '6-bestiary.webp', 55526::bigint),
    ('static-handbook-type-icons/v1/7-feats.png', '/static/handbook-types/7-feats.png', 'system-item-media/v1/static/handbook-types/7-feats/19cfa068b8c53eac07aa8a23fec5a3a5139778885e702f27daf3198fa914089c.webp', '7-feats.webp', 37468::bigint),
    ('static-handbook-type-icons/v1/8-races.png', '/static/handbook-types/8-races.png', 'system-item-media/v1/static/handbook-types/8-races/8ce51ea628bdf87bd47ee8f5e81459e21e6677113271ccfff502d8b5e0b55967.webp', '8-races.webp', 43356::bigint),
    ('static-handbook-type-icons/v1/9-classes.png', '/static/handbook-types/9-classes.png', 'system-item-media/v1/static/handbook-types/9-classes/a1a0246919769c4710d7239ef236678498c7137df38b4b908f491b155c2d6b2f.webp', '9-classes.webp', 43548::bigint),
    ('static-status-effect-media/v1/exhaustion/cover.jpg', '/static/status-effects/exhaustion-cover.jpg', 'system-item-media/v1/static/status-effects/exhaustion-cover/33fd9b7b4c6ee0493747ac398fc7c6d055ac488f4dc92422f204801e835a2714.webp', 'exhaustion-cover.webp', 21394::bigint),
    ('static-status-effect-media/v1/exhaustion/icon.png', '/static/status-effects/exhaustion-icon.png', 'system-item-media/v1/static/status-effects/exhaustion-icon/3931f3dcec8ed18f225cd27b4141ff68aae097fb05df7e1fbc6dff2590aa683d.webp', 'exhaustion-icon.webp', 43532::bigint),
    ('static-status-effect-media/v1/inspiration/cover.jpg', '/static/status-effects/inspiration-cover.jpg', 'system-item-media/v1/static/status-effects/inspiration-cover/86aac40df2a9542b68a73a23b4271b46589541b0e386af9730fd75ecd0546b57.webp', 'inspiration-cover.webp', 67824::bigint),
    ('static-status-effect-media/v1/inspiration/icon.png', '/static/status-effects/inspiration-icon.png', 'system-item-media/v1/static/status-effects/inspiration-icon/82854f32ce06749c710839a8609be4c80e986b478d647c06abbfc2cefa5f0c3e.webp', 'inspiration-icon.webp', 56882::bigint)
)
UPDATE dndshare.storage_image image
SET "key" = media.object_key,
    url = 'https://storage.yandexcloud.net/dndshare/' || media.object_key,
    file_name = media.file_name,
    mime_type = 'image/webp',
    file_size = media.file_size
FROM media
WHERE image.user_id IS NULL
  AND image."key" = media.legacy_key
  AND image.url = media.legacy_url;
