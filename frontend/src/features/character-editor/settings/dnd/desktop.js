import stats from './desktop/stats.json'
import main from './desktop/main.json'
import sidebar from './desktop/sidebar.json'

const desktop = {
  "tabs": [
    {
      "title": "База",
      "width": 1390,
      "content": {
        "kind": "layout",
        "type": "row",
        "props": {
          "gap": "11px"
        }
      },
      "default": true
    }
  ]
}
desktop.tabs[0].content.children = [stats, main, sidebar]
export default desktop
