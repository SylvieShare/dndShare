import { scopedSuite } from './playwright.shared.js'
export default scopedSuite("production", ["**/global-maps/workspaceEditing.spec.js"], { grep: /toolbar tools/ })
