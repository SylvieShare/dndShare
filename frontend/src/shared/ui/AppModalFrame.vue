<template>
  <AppModal
    ref="modal"
    flush
    :wide="wide"
    :extra-wide="extraWide"
    :fullscreen="fullscreen"
    :show-close="false"
    :show-handle="false"
    :dismissible="dismissible"
    :z-index="zIndex"
    @close="$emit('close')"
    @opened="$emit('opened')"
  >
    <section class="aem-shell">
      <header class="aem-header" :class="{ 'aem-header-with-actions': !!$slots['header-actions'] }">
        <span class="aem-handle" aria-hidden="true"></span>

        <div class="aem-heading">
          <slot name="title">
            <h2 class="aem-title">{{ title }}</h2>
            <span v-if="subtitle" class="aem-subtitle">{{ subtitle }}</span>
          </slot>
        </div>

        <div v-if="$slots['header-actions']" class="aem-header-actions">
          <slot name="header-actions" />
        </div>

        <button
          v-if="showClose"
          class="aem-close"
          type="button"
          aria-label="Закрыть"
          @click="requestClose"
        >
          <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <div
        class="aem-body"
        :class="{
          'aem-body-flush': !padded,
          'aem-body-no-scroll': !bodyScroll,
        }"
      >
        <slot />
      </div>

      <footer v-if="$slots.footer" class="aem-footer">
        <slot name="footer" />
      </footer>
    </section>
  </AppModal>
</template>

<script setup>
import { ref } from 'vue'
import AppModal from '@/shared/ui/AppModal.vue'

const modal = ref(null)

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: [String, Number], default: '' },
  wide: { type: Boolean, default: false },
  extraWide: { type: Boolean, default: false },
  fullscreen: { type: Boolean, default: false },
  padded: { type: Boolean, default: true },
  bodyScroll: { type: Boolean, default: true },
  dismissible: { type: Boolean, default: true },
  showClose: { type: Boolean, default: true },
  zIndex: { type: Number, default: 3000 },
})

defineEmits(['close', 'opened'])

function requestClose() {
  modal.value?.requestClose()
}
</script>

<style scoped>
.aem-shell {
  flex: 1;
  min-height: 0;
  max-height: inherit;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.aem-header {
  position: relative;
  z-index: 2;
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 58px;
  box-sizing: border-box;
  padding: 14px 54px 14px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.aem-heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 9px;
  flex: 0 1 auto;
}

.aem-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aem-subtitle {
  flex: none;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.2;
}

.aem-header-actions {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.aem-close {
  position: absolute;
  top: 50%;
  right: 16px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  touch-action: manipulation;
  transform: translateY(-50%);
  transition: color 0.15s, background 0.15s;
}

.aem-close:hover {
  color: var(--text-1);
  background: var(--surface-raised);
}

.aem-handle {
  display: none;
}

.aem-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding: 22px 24px 24px;
}

.aem-body-flush {
  gap: 0;
  padding: 0;
}

.aem-body-no-scroll {
  overflow: hidden;
}

.aem-footer {
  position: relative;
  z-index: 2;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-height: 62px;
  box-sizing: border-box;
  padding: 12px 24px;
  background: var(--bg);
  border-top: 1px solid var(--border);
}

@media (max-width: 640px) {
  .aem-header {
    min-height: 64px;
    padding: 27px 54px 12px 20px;
  }

  .aem-header-with-actions {
    flex-wrap: wrap;
  }

  .aem-handle {
    position: absolute;
    top: 8px;
    left: 50%;
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--text-muted);
    transform: translateX(-50%);
  }

  .aem-heading {
    max-width: 100%;
  }

  .aem-title {
    font-size: 20px;
  }

  .aem-header-actions {
    flex-basis: 100%;
    order: 2;
  }

  .aem-close {
    top: 31px;
    right: 12px;
  }

  .aem-body {
    padding: 18px 20px 24px;
  }

  .aem-body-flush {
    padding: 0;
  }

  .aem-footer {
    min-height: 66px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  }
}
</style>
