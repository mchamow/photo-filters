import { expect, it } from 'vitest'
import { ADJUSTMENTS, NEUTRAL, sameAdjustments } from './adjust'
import { PRESETS } from './presets'

it('has nine distinct presets, starting with the untouched original', () => {
  expect(PRESETS).toHaveLength(9)
  expect(new Set(PRESETS.map((p) => p.name)).size).toBe(9)
  expect(sameAdjustments(PRESETS[0].adjust, NEUTRAL)).toBe(true)
  for (let i = 0; i < PRESETS.length; i++)
    for (let j = i + 1; j < PRESETS.length; j++) expect(sameAdjustments(PRESETS[i].adjust, PRESETS[j].adjust)).toBe(false)
})

it('keeps every preset value inside its slider range', () => {
  for (const p of PRESETS)
    for (const a of ADJUSTMENTS) {
      expect(p.adjust[a.key]).toBeGreaterThanOrEqual(a.min)
      expect(p.adjust[a.key]).toBeLessThanOrEqual(a.max)
    }
})
