import { beforeEach, describe, expect, it } from 'vitest'
import { load, save } from './storage'

const fallback = { a: 'x', n: 1, on: false }

describe('storage', () => {
  beforeEach(() => localStorage.clear())

  it('returns the fallback when nothing is saved', () => {
    expect(load('k', fallback)).toEqual(fallback)
  })

  it('round-trips saved values', () => {
    save('k', { a: 'hello', n: 2, on: true })
    expect(load('k', fallback)).toEqual({ a: 'hello', n: 2, on: true })
  })

  it('falls back on corrupt JSON and non-objects', () => {
    localStorage.setItem('k', '{nope')
    expect(load('k', fallback)).toEqual(fallback)
    localStorage.setItem('k', '[1,2]')
    expect(load('k', fallback)).toEqual(fallback)
    localStorage.setItem('k', 'null')
    expect(load('k', fallback)).toEqual(fallback)
  })

  it('keeps defaults for fields with the wrong type', () => {
    localStorage.setItem('k', JSON.stringify({ a: 5, n: 7, on: 'yes' }))
    expect(load('k', fallback)).toEqual({ a: 'x', n: 7, on: false })
  })
})
