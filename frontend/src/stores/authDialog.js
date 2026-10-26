import { defineStore } from 'pinia'

// Transient navigation state only; credentials belong to the single dialog host.
export const useAuthDialogStore = defineStore('authDialog', {
  state: () => ({ view: null, reason: '' }),
  getters: {
    hint: state => ({
      'create-character': 'Для создания персонажа войдите или зарегистрируйтесь.',
      'clone-character': 'Чтобы клонировать персонажа себе, войдите или зарегистрируйтесь. После входа нажмите «Клонировать себе» снова.',
    }[state.reason] || ''),
  },
  actions: {
    openLogin(reason = '') {
      this.reason = reason
      this.view = 'login'
    },
    openRegistration() {
      this.view = 'registration'
    },
    close() {
      this.view = null
      this.reason = ''
    },
  },
})
