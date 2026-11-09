import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

type WindowMode = 'orb' | 'compact' | 'expanded'
type CompactView = 'home' | 'chat' | 'screenshot'
type WorkspaceSection = 'overview' | 'history' | 'sessions' | 'settings'

function App(): React.JSX.Element {
  const [mode, setMode] = useState<WindowMode>('orb')
  const [compactView, setCompactView] = useState<CompactView>('home')
  const [workspaceSection, setWorkspaceSection] =
    useState<WorkspaceSection>('overview')
  const orbDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)

function changeMode(nextMode: WindowMode): void {
    setMode(nextMode)
    window.electron.ipcRenderer.send('parsuram:window-mode', nextMode)
  }

  function openCompact(): void {
    setCompactView('home')
    changeMode('compact')
  }

  function minimizeCompact(): void {
    setCompactView('home')
    changeMode('orb')
  }

  function expandWorkspace(): void {
    setWorkspaceSection('overview')
    changeMode('expanded')
  }

  function minimizeExpanded(): void {
    setCompactView('home')
    changeMode('compact')
  }

  function handleOrbPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    orbDragRef.current = {
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      moved: false
    }

    window.electron.ipcRenderer.send('parsuram:orb-drag-start', {
      pointerX: event.screenX,
      pointerY: event.screenY
    })
  }

  function handleOrbPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = orbDragRef.current

    if (!drag || drag.pointerId !== event.pointerId) return

    if (Math.hypot(
      event.screenX - drag.startX,
      event.screenY - drag.startY
    ) > 5) {
      drag.moved = true
    }

    if (drag.moved) {
      window.electron.ipcRenderer.send('parsuram:orb-drag-move', {
        pointerX: event.screenX,
        pointerY: event.screenY
      })
    }
  }

  function handleOrbPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = orbDragRef.current

    if (!drag || drag.pointerId !== event.pointerId) return

    const wasDragged = drag.moved
    orbDragRef.current = null

    window.electron.ipcRenderer.send('parsuram:orb-drag-end')

    if (!wasDragged) {
      openCompact()
    }
  }

  function handleOrbPointerCancel(event: ReactPointerEvent<HTMLDivElement>): void {
    if (orbDragRef.current?.pointerId !== event.pointerId) return

    orbDragRef.current = null
    window.electron.ipcRenderer.send('parsuram:orb-drag-end')
  }
  function renderWorkspaceContent(): React.JSX.Element {
    if (workspaceSection === 'history') {
      return (
        <div className="empty-state">
          <div className="empty-icon">◷</div>
          <h2>Chat History</h2>
          <p>
            Your conversations will appear here when the chat module
            and local history storage are connected.
          </p>
          <span className="coming-label">HISTORY MODULE NOT CONNECTED</span>
        </div>
      )
    }

    if (workspaceSection === 'sessions') {
      return (
        <div className="empty-state">
          <div className="empty-icon">◎</div>
          <h2>Logins & Sessions</h2>
          <p>
            Account identity and session management will be added
            with the authentication module.
          </p>
          <span className="coming-label">SESSION MODULE NOT CONNECTED</span>
        </div>
      )
    }

    if (workspaceSection === 'settings') {
      return (
        <div className="empty-state">
          <div className="empty-icon">⚙</div>
          <h2>Settings</h2>
          <p>
            Personalization, privacy and application preferences
            will be configured here.
          </p>
          <span className="coming-label">SETTINGS MODULE NOT CONNECTED</span>
        </div>
      )
    }

    return (
      <>
        <div className="workspace-welcome">
          <span className="section-eyebrow">PERSONAL INTELLIGENCE</span>
          <h1>Your workspace.</h1>
          <p>
            A personal space to think, understand and work with Parsuram.
          </p>
        </div>

        <div className="workspace-grid">
          <button
            className="workspace-card"
            onClick={() => setWorkspaceSection('history')}
          >
            <span className="workspace-card-icon">◷</span>
            <strong>Chat History</strong>
            <small>View previous conversations</small>
            <span className="card-link">Open section →</span>
          </button>

          <button
            className="workspace-card"
            onClick={() => setWorkspaceSection('sessions')}
          >
            <span className="workspace-card-icon">◎</span>
            <strong>Logins & Sessions</strong>
            <small>Account and session management</small>
            <span className="card-link">Open section →</span>
          </button>

          <button
            className="workspace-card"
            onClick={() => setWorkspaceSection('settings')}
          >
            <span className="workspace-card-icon">⚙</span>
            <strong>Personalization & Settings</strong>
            <small>Privacy and assistant preferences</small>
            <span className="card-link">Open section →</span>
          </button>
        </div>

        <div className="workspace-note">
          <span className="status-indicator" />
          WINDOW MANAGER READY
          <span className="note-separator">·</span>
          AI MODULES WILL BE CONNECTED NEXT
        </div>
      </>
    )
  }

  return (
    <main className={`app-shell mode-${mode}`}>
      {mode === 'orb' && (
        <div
          className="orb-stage"
          role="button"
          tabIndex={0}
          aria-label="Open or move PARSURAM"
          title="Click to open · Drag to move"
          onPointerDown={handleOrbPointerDown}
          onPointerMove={handleOrbPointerMove}
          onPointerUp={handleOrbPointerUp}
          onPointerCancel={handleOrbPointerCancel}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openCompact()
            }
          }}
        >
          <div className="orb-halo orb-halo-one" />
          <div className="orb-halo orb-halo-two" />

          <div className="orb-core" aria-hidden="true">
            <span className="orb-sheen" />
            <span className="orb-energy-core" />
          </div>

          <span className="orb-caption">PARSURAM</span>
        </div>
      )}
{mode === 'compact' && (
        <section className="compact-window">
          <header className="compact-header drag-region">
            <div className="compact-brand">
              <div className="brand-emblem">P</div>
              <div>
                <span className="brand-eyebrow">PERSONAL INTELLIGENCE</span>
                <h1>PARSURAM</h1>
              </div>
            </div>

            <div className="window-controls no-drag">
              <button
                className="window-control"
                onClick={expandWorkspace}
                title="Expand workspace"
                aria-label="Expand workspace"
              >
                ⛶
              </button>

              <button
                className="window-control"
                onClick={minimizeCompact}
                title="Minimize to orb"
                aria-label="Minimize to orb"
              >
                −
              </button>
            </div>
          </header>

          {compactView === 'home' ? (
            <div className="compact-content">
              <div className="compact-welcome">
                <span className="section-eyebrow">YOUR SPACE</span>
                <h2>What are we working on?</h2>
                <p>Choose how you want to begin.</p>
              </div>

              <div className="action-list">
                <button
                  className="action-card"
                  onClick={() => setCompactView('chat')}
                >
                  <span className="action-icon">✧</span>
                  <span className="action-copy">
                    <strong>Chat with Parsuram</strong>
                    <small>Think, explore and solve together.</small>
                  </span>
                  <span className="action-arrow">↗</span>
                </button>

                <button
                  className="action-card"
                  onClick={() => setCompactView('screenshot')}
                >
                  <span className="action-icon">▣</span>
                  <span className="action-copy">
                    <strong>Screenshot Summary</strong>
                    <small>Capture your screen and understand it.</small>
                  </span>
                  <span className="action-arrow">↗</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="compact-placeholder">
              <span className="section-eyebrow">PARSURAM MODULE</span>

              <h2>
                {compactView === 'chat' ? 'Chat workspace' : 'Screenshot Summary'}
              </h2>

              <p>
                {compactView === 'chat'
                  ? 'The actual AI conversation engine will be connected in the Chat milestone.'
                  : 'Screen capture, preview and AI analysis will be connected in the Screenshot milestone.'}
              </p>

              <span className="coming-label">MODULE NOT CONNECTED YET</span>

              <button
                className="back-button"
                onClick={() => setCompactView('home')}
              >
                ← Back to options
              </button>
            </div>
          )}

          <footer className="compact-footer">
            <span className="status-indicator" />
            LOCAL DESKTOP SESSION
            <span className="version-label">V0.1</span>
          </footer>
        </section>
      )}

      {mode === 'expanded' && (
        <section className="expanded-workspace">
          <aside className="workspace-sidebar">
            <div className="sidebar-brand">
              <div className="brand-emblem">P</div>
              <div>
                <strong>PARSURAM</strong>
                <small>PERSONAL INTELLIGENCE</small>
              </div>
            </div>

            <span className="sidebar-label">WORKSPACE</span>

            <nav className="workspace-nav">
              <button
                className={workspaceSection === 'overview' ? 'nav-active' : ''}
                onClick={() => setWorkspaceSection('overview')}
              >
                <span>⌂</span> Overview
              </button>

              <button
                className={workspaceSection === 'history' ? 'nav-active' : ''}
                onClick={() => setWorkspaceSection('history')}
              >
                <span>◷</span> Chat History
              </button>

              <button
                className={workspaceSection === 'sessions' ? 'nav-active' : ''}
                onClick={() => setWorkspaceSection('sessions')}
              >
                <span>◎</span> Logins & Sessions
              </button>

              <button
                className={workspaceSection === 'settings' ? 'nav-active' : ''}
                onClick={() => setWorkspaceSection('settings')}
              >
                <span>⚙</span> Settings
              </button>
            </nav>

            <div className="sidebar-bottom">
              <span className="profile-avatar">P</span>
              <div>
                <strong>Local Profile</strong>
                <small>Account setup pending</small>
              </div>
            </div>
          </aside>

          <div className="workspace-main">
            <header className="workspace-topbar drag-region">
              <div className="topbar-title">
                <span>PERSONAL INTELLIGENT CURSOR</span>
                <strong>Parsuram Workspace</strong>
              </div>

              <div className="topbar-actions no-drag">
                <span className="workspace-status">
                  <span className="status-indicator" />
                  LOCAL MODE
                </span>

                <button
                  className="minimize-expanded"
                  onClick={minimizeExpanded}
                  title="Minimize to compact window"
                  aria-label="Minimize to compact window"
                >
                  −
                </button>
              </div>
            </header>

            <main className="workspace-content">
              {renderWorkspaceContent()}
            </main>
          </div>
        </section>
      )}
    </main>
  )
}

export default App



