import { copyDocument } from './documentPatch'
import { createDocumentChange, applyDocumentChange } from './documentHistory'

export function createDocumentUndo({ data, restore, onError }) {
  const history = [],
    future = []
  function apply(from, to, forward) {
    const step = from.at(-1)
    if (!step) return false
    let next
    try {
      next = applyDocumentChange(copyDocument(data()), step, forward)
    } catch (error) {
      onError(error)
      return false
    }
    from.pop()
    to.push(step)
    restore(next, forward ? 'redo' : 'undo')
    return true
  }
  return {
    record(before, after) {
      history.push(createDocumentChange(before, after))
      if (history.length > 50) history.shift()
      future.length = 0
    },
    undo: () => apply(history, future, false),
    redo: () => apply(future, history, true),
    clear() {
      history.length = future.length = 0
    },
    get canUndo() {
      return !!history.length
    },
    get canRedo() {
      return !!future.length
    },
  }
}
