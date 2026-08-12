<template>
  <div class="section-divider" aria-hidden="true">
    <span class="section-divider-mark" />
  </div>
</template>

<style scoped>
.section-divider {
  display: flex;
  align-items: center;
  width: 100%;
  height: 17px;
  gap: 10px;
}

.section-divider::before,
.section-divider::after {
  content: '';
  height: 1px;
  flex: 1 1 auto;
}

.section-divider::before {
  background: linear-gradient(to right, transparent, color-mix(in srgb, var(--text-muted) 30%, transparent));
}

.section-divider::after {
  background: linear-gradient(to left, transparent, color-mix(in srgb, var(--text-muted) 30%, transparent));
}

.section-divider-mark {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--accent) 56%, var(--text-muted));
  transform: rotate(45deg);
}
</style>
