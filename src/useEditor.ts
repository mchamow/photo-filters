import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { flip, ORIGINAL, rotate, sanitizeEdit, type AdjustmentKey, type Adjustments, type Edit } from './adjust'
import { historyReducer, initHistory } from './history'
import { load, save } from './storage'

export const EDIT_KEY = 'photo-filters:edit:v1'

/** The current edit with undo/redo, saved to localStorage as it changes. */
export function useEditor() {
  const [history, dispatch] = useReducer(historyReducer<Edit>, undefined, () =>
    initHistory(sanitizeEdit(load(EDIT_KEY, { edit: ORIGINAL }).edit)),
  )
  const edit = history.present

  useEffect(() => save(EDIT_KEY, { edit }), [edit])

  const set = useCallback(
    (value: Edit | ((present: Edit) => Edit), group?: string) => dispatch({ type: 'set', value, group }),
    [],
  )

  const actions = useMemo(
    () => ({
      /** Live slider changes: one drag (or a run of arrow keys) on one slider is one undo step. */
      adjust: (key: AdjustmentKey, value: number) => set((e) => ({ ...e, adjust: { ...e.adjust, [key]: value } }), key),
      /** Called when a slider is let go or left, so the next change to it is its own step. */
      commit: () => dispatch({ type: 'commit' }),
      applyLook: (adjust: Adjustments) => set((e) => ({ ...e, adjust })),
      rotate: (direction: 'left' | 'right') => set((e) => rotate(e, direction)),
      flip: (axis: 'horizontal' | 'vertical') => set((e) => flip(e, axis)),
      resetAll: () => set(ORIGINAL),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      /** A new photo keeps the look but not the old photo's rotation, and starts a fresh history. */
      newPhoto: () => dispatch({ type: 'reset', value: (e) => ({ ...ORIGINAL, adjust: e.adjust }) }),
    }),
    [set],
  )

  return { edit, canUndo: history.past.length > 0, canRedo: history.future.length > 0, ...actions }
}

export type Editor = ReturnType<typeof useEditor>
