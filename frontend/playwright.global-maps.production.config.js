import { scopedSuite } from './playwright.shared.js'
export default scopedSuite("production", ["**/global-maps/*.spec.js"])
