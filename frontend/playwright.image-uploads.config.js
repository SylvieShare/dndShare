import { scopedSuite } from './playwright.shared.js'
export default scopedSuite("production", ["**/image-uploads/*.spec.js"])
