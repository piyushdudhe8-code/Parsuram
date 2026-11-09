import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

type WindowMode = 'orb' | 'compact' | 'expanded'

const ORB_SIZE = 112
const COMPACT_WIDTH = 390
const COMPACT_HEIGHT = 470
const EDGE_MARGIN = 20

let mainWindow: BrowserWindow | null = null
let currentMode: WindowMode = 'orb'
let stateFile = ''
let orbPosition: { x: number; y: number } | null = null

let activeOrbDrag: {
  windowId: number
  startPointerX: number
  startPointerY: number
  startWindowX: number
  startWindowY: number
} | null = null

let positionSaveTimer: ReturnType<typeof setTimeout> | null = null

let activeDrag: {
  windowId: number
  cursorX: number
  cursorY: number
  windowX: number
  windowY: number
} | null = null

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

async function loadSavedPosition(): Promise<void> {
  stateFile = join(app.getPath('userData'), 'parsuram-window-state.json')

  try {
    const raw = await readFile(stateFile, 'utf8')
    const saved = JSON.parse(raw) as { x?: number; y?: number }

    if (
      typeof saved.x === 'number' &&
      Number.isFinite(saved.x) &&
      typeof saved.y === 'number' &&
      Number.isFinite(saved.y)
    ) {
      orbPosition = { x: saved.x, y: saved.y }
    }
  } catch {
    orbPosition = null
  }
}

async function savePosition(): Promise<void> {
  if (!orbPosition || !stateFile) return

  try {
    await writeFile(stateFile, JSON.stringify(orbPosition, null, 2), 'utf8')
  } catch (error) {
    console.error('Unable to save PARSURAM position:', error)
  }
}

function getOrbBounds() {
  const primaryBounds = screen.getPrimaryDisplay().bounds

  const initialPosition = orbPosition ?? {
    x: primaryBounds.x + primaryBounds.width - ORB_SIZE - EDGE_MARGIN,
    y: primaryBounds.y + primaryBounds.height - ORB_SIZE - EDGE_MARGIN
  }

  const center = {
    x: initialPosition.x + ORB_SIZE / 2,
    y: initialPosition.y + ORB_SIZE / 2
  }

  const display = screen.getDisplayNearestPoint(center)
  const area = display.bounds

  const x = clamp(
    initialPosition.x,
    area.x,
    area.x + area.width - ORB_SIZE
  )

  const y = clamp(
    initialPosition.y,
    area.y,
    area.y + area.height - ORB_SIZE
  )

  orbPosition = { x, y }

  return { x, y, width: ORB_SIZE, height: ORB_SIZE }
}

function getCompactBounds() {
  const orb = getOrbBounds()
  const display = screen.getDisplayMatching(orb)
  const area = display.workArea

  const x = clamp(
    orb.x + ORB_SIZE / 2 - COMPACT_WIDTH / 2,
    area.x,
    area.x + area.width - COMPACT_WIDTH
  )

  const y = clamp(
    orb.y + ORB_SIZE / 2 - COMPACT_HEIGHT / 2,
    area.y,
    area.y + area.height - COMPACT_HEIGHT
  )

  return {
    x,
    y,
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT
  }
}

function getExpandedBounds(window: BrowserWindow) {
  const display = screen.getDisplayMatching(window.getBounds())
  return display.workArea
}

function applyWindowMode(mode: WindowMode, window: BrowserWindow): void {
  currentMode = mode

  if (mode === 'expanded') {
    window.setMinimumSize(900, 600)
    window.setResizable(false)
    window.setSkipTaskbar(false)
    window.setAlwaysOnTop(false)
    window.setBackgroundColor('#080b18')
    window.setBounds(getExpandedBounds(window))
  } else {
    window.setMinimumSize(1, 1)
    window.setResizable(false)
    window.setSkipTaskbar(true)
    window.setAlwaysOnTop(true, 'floating')
    window.setBackgroundColor('#00000000')

    if (mode === 'orb') {
      window.setBounds(getOrbBounds())
    } else {
      window.setBounds(getCompactBounds())
    }
  }

  window.show()
  window.focus()
}

function isWindowMode(value: unknown): value is WindowMode {
  return value === 'orb' || value === 'compact' || value === 'expanded'
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...getOrbBounds(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.setAlwaysOnTop(true, 'floating')
  })

  mainWindow.on('move', () => {
    if (currentMode !== 'orb' || !mainWindow || mainWindow.isDestroyed()) {
      return
    }

    const bounds = mainWindow.getBounds()

    orbPosition = {
      x: bounds.x,
      y: bounds.y
    }

    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer)
    }

    positionSaveTimer = setTimeout(() => {
      positionSaveTimer = null
      void savePosition()
    }, 300)
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.parsuram.desktop')

  await loadSavedPosition()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('parsuram:window-mode', (event, requestedMode: unknown) => {
    if (!isWindowMode(requestedMode)) return

    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || window.isDestroyed()) return

    applyWindowMode(requestedMode, window)
  })

  ipcMain.on('parsuram:drag-start', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    if (!window || window.isDestroyed() || currentMode !== 'orb') return

    const cursor = screen.getCursorScreenPoint()
    const bounds = window.getBounds()

    activeDrag = {
      windowId: window.id,
      cursorX: cursor.x,
      cursorY: cursor.y,
      windowX: bounds.x,
      windowY: bounds.y
    }
  })

  ipcMain.on('parsuram:drag-move', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    if (
      !window ||
      window.isDestroyed() ||
      !activeDrag ||
      activeDrag.windowId !== window.id ||
      currentMode !== 'orb'
    ) {
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const windowBounds = window.getBounds()

    const desiredX =
      activeDrag.windowX + cursor.x - activeDrag.cursorX

    const desiredY =
      activeDrag.windowY + cursor.y - activeDrag.cursorY

    const center = {
      x: desiredX + windowBounds.width / 2,
      y: desiredY + windowBounds.height / 2
    }

    const display = screen.getDisplayNearestPoint(center)
    const area = display.bounds

    const x = clamp(
      desiredX,
      area.x,
      area.x + area.width - windowBounds.width
    )

    const y = clamp(
      desiredY,
      area.y,
      area.y + area.height - windowBounds.height
    )

    window.setPosition(Math.round(x), Math.round(y))
    orbPosition = { x: Math.round(x), y: Math.round(y) }
  })

  ipcMain.on('parsuram:drag-end', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    if (
      !window ||
      !activeDrag ||
      activeDrag.windowId !== window.id
    ) {
      return
    }

    activeDrag = null
    orbPosition = {
      x: window.getBounds().x,
      y: window.getBounds().y
    }

    await savePosition()
  })

  ipcMain.on('parsuram:orb-drag-start', (event, payload: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const data = payload as { pointerX?: number; pointerY?: number } | null

    if (!window || window.isDestroyed() || currentMode !== 'orb') return

    if (
      typeof data?.pointerX !== 'number' ||
      typeof data?.pointerY !== 'number' ||
      !Number.isFinite(data.pointerX) ||
      !Number.isFinite(data.pointerY)
    ) return

    const bounds = window.getBounds()

    activeOrbDrag = {
      windowId: window.id,
      startPointerX: data.pointerX,
      startPointerY: data.pointerY,
      startWindowX: bounds.x,
      startWindowY: bounds.y
    }
  })

  ipcMain.on('parsuram:orb-drag-move', (event, payload: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const data = payload as { pointerX?: number; pointerY?: number } | null

    if (
      !window ||
      window.isDestroyed() ||
      !activeOrbDrag ||
      activeOrbDrag.windowId !== window.id ||
      currentMode !== 'orb'
    ) return

    if (
      typeof data?.pointerX !== 'number' ||
      typeof data?.pointerY !== 'number' ||
      !Number.isFinite(data.pointerX) ||
      !Number.isFinite(data.pointerY)
    ) return

    const desiredX =
      activeOrbDrag.startWindowX +
      data.pointerX - activeOrbDrag.startPointerX

    const desiredY =
      activeOrbDrag.startWindowY +
      data.pointerY - activeOrbDrag.startPointerY

    const display = screen.getDisplayNearestPoint({
      x: data.pointerX,
      y: data.pointerY
    })

    const area = display.bounds
    const bounds = window.getBounds()

    const maxX = Math.max(area.x, area.x + area.width - bounds.width)
    const maxY = Math.max(area.y, area.y + area.height - bounds.height)

    const x = clamp(desiredX, area.x, maxX)
    const y = clamp(desiredY, area.y, maxY)

    window.setPosition(Math.round(x), Math.round(y))
    orbPosition = { x: Math.round(x), y: Math.round(y) }
  })

  ipcMain.on('parsuram:orb-drag-end', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    if (
      !window ||
      !activeOrbDrag ||
      activeOrbDrag.windowId !== window.id
    ) return

    activeOrbDrag = null

    const bounds = window.getBounds()
    orbPosition = { x: bounds.x, y: bounds.y }

    void savePosition()
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})



