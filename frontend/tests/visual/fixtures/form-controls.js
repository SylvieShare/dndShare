import { createApp } from 'vue'
import { clickOutside } from '../../../src/shared/lib/clickOutside'
import FormControlsFixture from './FormControlsFixture.vue'

createApp(FormControlsFixture)
  .directive('click-outside', clickOutside)
  .mount('#app')
