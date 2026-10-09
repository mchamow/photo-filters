import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { decode, encode, paint, type Decoded } from './image'
import { createPixels, type Pixels } from './pixels'
import { EDIT_KEY } from './useEditor'
import { IMAGE_KEY } from './usePhoto'

// jsdom can't decode images or draw on a canvas, so the browser end is faked: every photo is flat grey.
vi.mock('./image', () => ({
  decode: vi.fn(),
  paint: vi.fn(),
  encode: vi.fn(),
  toDataUrl: vi.fn(() => 'data:image/webp;base64,UklGRg=='),
}))

const grey = (w: number, h: number): Pixels => createPixels(w, h, [100, 100, 100, 255])
const fakePhoto = (): Decoded => ({ full: grey(400, 200), preview: grey(4, 2), thumb: grey(2, 1) })

const slider = (name: string) => screen.getByRole('slider', { name }) as HTMLInputElement
const move = (name: string, value: number) => fireEvent.change(slider(name), { target: { value: String(value) } })
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const pressed = (name: string) => button(name).getAttribute('aria-pressed') === 'true'
const key = (code: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { code, key: code.replace(/^(Key|Digit)/, '').toLowerCase(), ...init })

/** The red level of the top-left pixel last painted into the edited-photo canvas. */
function editedLevel() {
  const canvas = screen.getByRole('img', { name: 'Edited photo' })
  const call = vi.mocked(paint).mock.calls.findLast(([c]) => c === canvas)
  return call?.[1].data[0]
}

async function ready() {
  render(<App />)
  await screen.findByRole('img', { name: 'Edited photo' })
}

let clicks: HTMLAnchorElement[] = []

beforeEach(() => {
  localStorage.clear()
  vi.mocked(decode).mockReset().mockImplementation(async () => fakePhoto())
  vi.mocked(paint).mockClear()
  vi.mocked(encode).mockReset().mockResolvedValue(new Blob(['x']))
  clicks = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(this)
  })
  URL.createObjectURL = vi.fn(() => 'blob:edited')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('opens the sample image on a first visit', async () => {
    await ready()
    expect(vi.mocked(decode).mock.calls[0][0]).toMatch(/sample\.svg/)
    expect(screen.getByText('sample.svg')).toBeTruthy()
    expect(screen.getByText(/400 × 200/)).toBeTruthy()
    expect(editedLevel()).toBe(100)
  })

  it('re-renders the photo as a slider moves, and shows the value', async () => {
    await ready()
    move('Brightness', 100)
    expect(editedLevel()).toBe(200)
    expect(button('Reset Brightness').textContent).toBe('+100')
    move('Contrast', -100)
    expect(editedLevel()).toBe(128)
  })

  it('resets one slider from its value, or everything at once', async () => {
    await ready()
    move('Brightness', 40)
    move('Sepia', 30)
    fireEvent.click(button('Reset Brightness'))
    expect(slider('Brightness').value).toBe('0')
    expect(slider('Sepia').value).toBe('30')
    fireEvent.click(button(/reset all/i))
    expect(slider('Sepia').value).toBe('0')
    expect(button(/reset all/i).hasAttribute('disabled')).toBe(true)
  })

  it('applies presets by click or number key, and marks the active one', async () => {
    await ready()
    expect(pressed('Original')).toBe(true)
    fireEvent.click(button('Noir'))
    expect(pressed('Noir')).toBe(true)
    expect(slider('Saturation').value).toBe('-100')
    expect(slider('Vignette').value).toBe('60')
    key('Digit2')
    expect(pressed('Vivid')).toBe(true)
    // Nudging a slider leaves the preset behind.
    move('Contrast', 3)
    expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent)).not.toContain('Vivid')
  })

  it('renders a thumbnail per preset', async () => {
    await ready()
    const thumbs = vi.mocked(paint).mock.calls.filter(([, px]) => px.width === 2)
    expect(thumbs.length).toBeGreaterThanOrEqual(9)
  })

  it('undoes and redoes, treating one slider drag as one step', async () => {
    await ready()
    expect(button('Undo').hasAttribute('disabled')).toBe(true)
    move('Brightness', 10)
    move('Brightness', 20)
    move('Brightness', 30)
    fireEvent.click(button('Vivid'))
    fireEvent.click(button('Undo'))
    expect(slider('Brightness').value).toBe('30')
    fireEvent.click(button('Undo'))
    expect(slider('Brightness').value).toBe('0')
    expect(button('Undo').hasAttribute('disabled')).toBe(true)
    fireEvent.click(button('Redo'))
    expect(slider('Brightness').value).toBe('30')
    key('KeyZ', { ctrlKey: true })
    expect(slider('Brightness').value).toBe('0')
    key('KeyZ', { metaKey: true, shiftKey: true })
    expect(slider('Brightness').value).toBe('30')
  })

  it('makes a new undo step once a slider is let go', async () => {
    await ready()
    move('Fade', 10)
    fireEvent.pointerUp(slider('Fade'))
    move('Fade', 20)
    fireEvent.blur(slider('Fade'))
    move('Fade', 30)
    key('KeyZ', { ctrlKey: true })
    expect(slider('Fade').value).toBe('20')
    key('KeyZ', { ctrlKey: true })
    expect(slider('Fade').value).toBe('10')
  })

  it('rotates and flips with buttons and keys', async () => {
    await ready()
    fireEvent.click(button('Rotate right'))
    expect(screen.getByText(/200 × 400/)).toBeTruthy()
    key('KeyR', { shiftKey: true })
    expect(screen.getByText(/400 × 200/)).toBeTruthy()
    key('KeyR')
    expect(screen.getByText(/200 × 400/)).toBeTruthy()
    fireEvent.click(button('Flip horizontally'))
    key('KeyV')
    expect(JSON.parse(localStorage.getItem(EDIT_KEY)!).edit).toMatchObject({ rotation: 270, flipH: false, flipV: false })
    fireEvent.click(button('Undo'))
    expect(JSON.parse(localStorage.getItem(EDIT_KEY)!).edit).toMatchObject({ rotation: 90, flipH: true })
  })

  it('shows a before/after split that moves with the arrow keys', async () => {
    await ready()
    expect(screen.queryByRole('img', { name: 'Original photo' })).toBeNull()
    fireEvent.click(button('Compare'))
    expect(screen.getByRole('img', { name: 'Original photo' })).toBeTruthy()
    const handle = screen.getByRole('slider', { name: 'Before/after split' })
    expect(handle.getAttribute('aria-valuenow')).toBe('50')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(handle.getAttribute('aria-valuenow')).toBe('38')
    fireEvent.keyDown(handle, { key: 'End' })
    expect(handle.getAttribute('aria-valuenow')).toBe('100')
    key('KeyC')
    expect(screen.queryByRole('slider', { name: 'Before/after split' })).toBeNull()
  })

  it('shows the original while B (or the Before button) is held', async () => {
    await ready()
    move('Brightness', 100)
    key('KeyB')
    const original = screen.getByRole('img', { name: 'Original photo' })
    expect(vi.mocked(paint).mock.calls.findLast(([c]) => c === original)?.[1].data[0]).toBe(100)
    fireEvent.keyUp(window, { code: 'KeyB' })
    expect(screen.queryByRole('img', { name: 'Original photo' })).toBeNull()
    fireEvent.pointerDown(button('Hold to see the original'))
    expect(screen.getByRole('img', { name: 'Original photo' })).toBeTruthy()
    fireEvent.pointerUp(button('Hold to see the original'))
    expect(screen.queryByRole('img', { name: 'Original photo' })).toBeNull()
  })

  it('opens a photo from the file picker, keeping the look but not the rotation', async () => {
    await ready()
    move('Warmth', 25)
    fireEvent.click(button('Rotate right'))
    const file = new File(['jpeg'], 'beach.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Photo file'), { target: { files: [file] } })
    expect(await screen.findByText('beach.jpg')).toBeTruthy()
    expect(vi.mocked(decode)).toHaveBeenLastCalledWith(file)
    expect(screen.getByText(/400 × 200/)).toBeTruthy()
    expect(slider('Warmth').value).toBe('25')
    expect(button('Undo').hasAttribute('disabled')).toBe(true)
    expect(JSON.parse(localStorage.getItem(IMAGE_KEY)!)).toEqual({ name: 'beach.jpg', dataUrl: 'data:image/webp;base64,UklGRg==' })
  })

  it('opens a dropped or pasted photo', async () => {
    await ready()
    const dropped = new File(['png'], 'dropped.png', { type: 'image/png' })
    fireEvent.dragOver(window, { dataTransfer: { types: ['Files'], files: [dropped] } })
    expect(screen.getByText(/drop the photo to open it/i)).toBeTruthy()
    fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [dropped] } })
    expect(await screen.findByText('dropped.png')).toBeTruthy()
    expect(screen.queryByText(/drop the photo to open it/i)).toBeNull()

    const pasted = new File(['png'], 'pasted.png', { type: 'image/png' })
    fireEvent.paste(window, { clipboardData: { files: [pasted] } })
    expect(await screen.findByText('pasted.png')).toBeTruthy()
  })

  it('explains a file that will not open, and keeps the current photo', async () => {
    await ready()
    vi.mocked(decode).mockRejectedValueOnce(new Error('bad'))
    fireEvent.change(screen.getByLabelText('Photo file'), { target: { files: [new File(['?'], 'notes.png', { type: 'image/png' })] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn't open “notes\.png”/i)
    expect(screen.getByText('sample.svg')).toBeTruthy()
    fireEvent.click(button('Dismiss'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('downloads the full-size edit as PNG or JPEG', async () => {
    await ready()
    move('Brightness', 100)
    fireEvent.click(button(/^download/i))
    await waitFor(() => expect(clicks).toHaveLength(1))
    const [px, type] = vi.mocked(encode).mock.calls[0]
    expect([px.width, px.height, px.data[0], type]).toEqual([400, 200, 200, 'image/png'])
    expect(clicks[0].download).toBe('sample-edited.png')
    expect(clicks[0].href).toBe('blob:edited')

    fireEvent.click(button('JPEG'))
    key('KeyS', { ctrlKey: true })
    await waitFor(() => expect(clicks).toHaveLength(2))
    expect(vi.mocked(encode).mock.calls[1][1]).toBe('image/jpeg')
    expect(clicks[1].download).toBe('sample-edited.jpg')
  })

  it('remembers the photo, the edit and the format after a reload', async () => {
    await ready()
    const file = new File(['jpeg'], 'cat.jpeg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Photo file'), { target: { files: [file] } })
    await screen.findByText('cat.jpeg')
    move('Fade', 35)
    fireEvent.click(button('Rotate left'))
    fireEvent.click(button('JPEG'))
    cleanup()

    await ready()
    expect(vi.mocked(decode)).toHaveBeenLastCalledWith('data:image/webp;base64,UklGRg==')
    expect(screen.getByText('cat.jpeg')).toBeTruthy()
    expect(slider('Fade').value).toBe('35')
    expect(screen.getByText(/200 × 400/)).toBeTruthy()
    expect(pressed('JPEG')).toBe(true)
  })

  it('falls back to the sample when the saved photo is corrupt', async () => {
    localStorage.setItem(IMAGE_KEY, JSON.stringify({ name: 'gone.png', dataUrl: 'data:image/png;base64,broken' }))
    vi.mocked(decode).mockImplementation(async (src) => {
      if (typeof src === 'string' && src.startsWith('data:')) throw new Error('corrupt')
      return fakePhoto()
    })
    await ready()
    expect(screen.getByText('sample.svg')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(localStorage.getItem(IMAGE_KEY)).toBeNull()
  })

  it('ignores corrupt saved settings', async () => {
    localStorage.setItem(EDIT_KEY, '{oops')
    await ready()
    expect(slider('Brightness').value).toBe('0')
    await act(async () => {})
  })
})
