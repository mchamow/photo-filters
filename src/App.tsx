import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  Columns2,
  Download,
  Eye,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  Redo2,
  RotateCcw,
  RotateCcwSquare,
  RotateCwSquare,
  TrianglesCenterlineDashedHorizontal,
  TrianglesCenterlineDashedVertical,
  Undo2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AdjustPanel } from './AdjustPanel'
import { ORIGINAL, render } from './adjust'
import { Histogram } from './Histogram'
import { encode } from './image'
import { histogram, orient } from './pixels'
import { PRESETS } from './presets'
import { PresetStrip } from './PresetStrip'
import { Stage } from './Stage'
import { load, save } from './storage'
import { useEditor } from './useEditor'
import { baseName, usePhoto } from './usePhoto'

export const SETTINGS_KEY = 'photo-filters:settings:v1'
type Format = 'png' | 'jpeg'
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

function Hint({ label, keys, children }: { label: string; keys?: ReactNode; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>
        {label} {keys}
      </TooltipContent>
    </Tooltip>
  )
}

const isImageFile = (f: File | undefined): f is File => !!f && (f.type === '' || f.type.startsWith('image/'))
const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')

export default function App() {
  const editor = useEditor()
  const { edit } = editor
  const { photo, error, loading, openFile, openSample, dismissError } = usePhoto(editor.newPhoto)
  const [format, setFormat] = useState<Format>(() =>
    load(SETTINGS_KEY, { format: 'png' }).format === 'jpeg' ? 'jpeg' : 'png',
  )
  const [compare, setCompare] = useState(false)
  const [split, setSplit] = useState(50)
  const [peek, setPeek] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => save(SETTINGS_KEY, { format }), [format])

  // Re-rendering a megapixel preview takes a few milliseconds; deferring it keeps the sliders responsive.
  const deferredEdit = useDeferredValue(edit)
  const after = useMemo(() => (photo ? render(photo.preview, deferredEdit) : null), [photo, deferredEdit])
  const { rotation, flipH, flipV } = deferredEdit
  const before = useMemo(
    () => (photo && (compare || peek) ? orient(photo.preview, rotation, flipH, flipV) : null),
    [photo, compare, peek, rotation, flipH, flipV],
  )
  const counts = useMemo(() => (after ? histogram(after) : null), [after])

  const download = useCallback(async () => {
    if (!photo || exporting) return
    setExporting(true)
    try {
      // Let the spinner paint before the full-size render blocks the thread.
      await new Promise((r) => setTimeout(r, 0))
      const blob = await encode(render(photo.full, edit), format === 'jpeg' ? 'image/jpeg' : 'image/png')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${baseName(photo.name)}-edited.${format === 'jpeg' ? 'jpg' : 'png'}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } finally {
      setExporting(false)
    }
  }, [photo, exporting, edit, format])

  const pickFile = () => fileInput.current?.click()

  // Keyboard shortcuts. Letters still work from a focused slider, which only wants the arrows.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof Element && target.closest('input:not([type=range]), textarea, [contenteditable=true]')) return
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase()
        const run =
          key === 'z'
            ? e.shiftKey
              ? editor.redo
              : editor.undo
            : key === 'y'
              ? editor.redo
              : key === 'o'
                ? pickFile
                : key === 's'
                  ? download
                  : null
        if (run) {
          e.preventDefault()
          void run()
        }
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const digit = /^Digit([1-9])$/.exec(e.code)
      if (digit) {
        editor.applyLook(PRESETS[Number(digit[1]) - 1].adjust)
        return
      }
      if (e.code === 'KeyR') editor.rotate(e.shiftKey ? 'left' : 'right')
      else if (e.code === 'KeyH') editor.flip('horizontal')
      else if (e.code === 'KeyV') editor.flip('vertical')
      else if (e.code === 'KeyC') setCompare((c) => !c)
      else if (e.code === 'KeyB') setPeek(true)
      else return
      e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyB') setPeek(false)
    }
    const stopPeek = () => setPeek(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', stopPeek)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', stopPeek)
    }
  }, [editor, download])

  // Drop a file anywhere on the page, or paste one.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) openFile(file)
    }
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      openFile(file)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [openFile])

  const sideways = edit.rotation === 90 || edit.rotation === 270
  const size =
    photo && (sideways ? `${photo.full.height} × ${photo.full.width}` : `${photo.full.width} × ${photo.full.height}`)
  const untouched = JSON.stringify(edit) === JSON.stringify(ORIGINAL)

  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            <span aria-hidden="true">📷</span> Photo Filters
          </h1>
          <p className="mt-1 text-muted-foreground">Tune photos with sliders and presets, right in the browser.</p>
        </header>

        <div role="toolbar" aria-label="Tools" className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            aria-label="Photo file"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (isImageFile(file)) openFile(file)
              e.target.value = ''
            }}
          />
          <Hint label="Open a photo" keys={<Kbd>{MOD} O</Kbd>}>
            <Button onClick={pickFile}>
              <FolderOpen data-icon="inline-start" /> Open
            </Button>
          </Hint>
          <Hint label="Load the sample image">
            <Button variant="outline" onClick={openSample} aria-label="Sample image">
              <ImagePlus data-icon="inline-start" />
              <span className="max-sm:hidden">Sample</span>
            </Button>
          </Hint>
          <Separator orientation="vertical" className="mx-1 h-6 max-sm:hidden" />
          <Hint label="Rotate left" keys={<Kbd>Shift R</Kbd>}>
            <Button
              variant="outline"
              size="icon"
              aria-label="Rotate left"
              onClick={() => editor.rotate('left')}
              disabled={!photo}
            >
              <RotateCcwSquare />
            </Button>
          </Hint>
          <Hint label="Rotate right" keys={<Kbd>R</Kbd>}>
            <Button
              variant="outline"
              size="icon"
              aria-label="Rotate right"
              onClick={() => editor.rotate('right')}
              disabled={!photo}
            >
              <RotateCwSquare />
            </Button>
          </Hint>
          <Hint label="Flip horizontally" keys={<Kbd>H</Kbd>}>
            <Button
              variant="outline"
              size="icon"
              aria-label="Flip horizontally"
              onClick={() => editor.flip('horizontal')}
              disabled={!photo}
            >
              <TrianglesCenterlineDashedVertical />
            </Button>
          </Hint>
          <Hint label="Flip vertically" keys={<Kbd>V</Kbd>}>
            <Button
              variant="outline"
              size="icon"
              aria-label="Flip vertically"
              onClick={() => editor.flip('vertical')}
              disabled={!photo}
            >
              <TrianglesCenterlineDashedHorizontal />
            </Button>
          </Hint>
          <Separator orientation="vertical" className="mx-1 h-6 max-sm:hidden" />
          <Hint label="Undo" keys={<Kbd>{MOD} Z</Kbd>}>
            <Button variant="outline" size="icon" aria-label="Undo" onClick={editor.undo} disabled={!editor.canUndo}>
              <Undo2 />
            </Button>
          </Hint>
          <Hint label="Redo" keys={<Kbd>{MOD} Shift Z</Kbd>}>
            <Button variant="outline" size="icon" aria-label="Redo" onClick={editor.redo} disabled={!editor.canRedo}>
              <Redo2 />
            </Button>
          </Hint>
          <Separator orientation="vertical" className="mx-1 h-6 max-sm:hidden" />
          <Hint label="Before/after split" keys={<Kbd>C</Kbd>}>
            <Toggle
              variant="outline"
              aria-label="Compare"
              pressed={compare}
              onPressedChange={setCompare}
              disabled={!photo}
            >
              <Columns2 data-icon="inline-start" />
              <span className="max-sm:hidden">Compare</span>
            </Toggle>
          </Hint>
          <Hint label="Hold to see the original" keys={<Kbd>B</Kbd>}>
            <Button
              variant="outline"
              aria-label="Hold to see the original"
              disabled={!photo}
              onPointerDown={() => setPeek(true)}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
              onPointerCancel={() => setPeek(false)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setPeek(true)
              }}
              onKeyUp={() => setPeek(false)}
              onBlur={() => setPeek(false)}
              className="touch-none select-none"
            >
              <Eye data-icon="inline-start" />
              <span className="max-sm:hidden">Before</span>
            </Button>
          </Hint>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismissError}>
              <X />
            </Button>
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Photo" className="flex min-w-0 flex-col gap-3">
            <Stage
              after={after}
              before={before}
              compare={compare}
              peek={peek}
              split={split}
              onSplit={setSplit}
              loading={loading}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="min-w-0 truncate text-sm text-muted-foreground" aria-live="polite">
                {photo ? (
                  <>
                    <span className="font-medium text-foreground">{photo.name}</span> · {size}
                  </>
                ) : (
                  'Loading…'
                )}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <ToggleGroup
                  aria-label="File format"
                  variant="outline"
                  spacing={0}
                  value={[format]}
                  onValueChange={(v) => setFormat((v[0] as Format | undefined) ?? format)}
                >
                  <ToggleGroupItem value="png">PNG</ToggleGroupItem>
                  <ToggleGroupItem value="jpeg">JPEG</ToggleGroupItem>
                </ToggleGroup>
                <Hint label="Download the edited photo" keys={<Kbd>{MOD} S</Kbd>}>
                  <Button onClick={() => void download()} disabled={!photo || exporting}>
                    {exporting ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <Download data-icon="inline-start" />
                    )}
                    Download
                  </Button>
                </Hint>
              </div>
            </div>
            <section aria-label="Presets" className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Presets</h2>
              <PresetStrip thumb={photo?.thumb ?? null} edit={edit} onPick={editor.applyLook} />
            </section>
          </section>

          <aside
            aria-label="Adjustments"
            className="flex flex-col gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Adjustments</h2>
              <Button variant="ghost" size="sm" onClick={editor.resetAll} disabled={untouched}>
                <RotateCcw data-icon="inline-start" /> Reset all
              </Button>
            </div>
            <Histogram counts={counts} />
            <AdjustPanel adjust={edit.adjust} disabled={!photo} onChange={editor.adjust} onCommit={editor.commit} />
          </aside>
        </div>

        <footer className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            <Kbd>1</Kbd>–<Kbd>9</Kbd> presets
          </span>
          <span>
            <Kbd>R</Kbd> rotate · <Kbd>H</Kbd>/<Kbd>V</Kbd> flip
          </span>
          <span>
            <Kbd>C</Kbd> compare · hold <Kbd>B</Kbd> for the original
          </span>
          <span>
            <Kbd>{MOD} Z</Kbd> undo · <Kbd>{MOD} S</Kbd> download
          </span>
          <span>Drop or paste a photo anywhere. Nothing leaves your browser.</span>
        </footer>
      </main>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="flex size-full items-center justify-center rounded-2xl border-2 border-dashed border-primary text-lg font-medium">
            Drop the photo to open it
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
