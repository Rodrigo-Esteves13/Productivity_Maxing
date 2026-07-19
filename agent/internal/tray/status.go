// Package tray adds a Windows system tray icon around the agent's
// existing polling loop. It does not know anything about hosts files,
// processes, or the remote API - it only needs a way to read the current
// status (GetStatus) and two lifecycle hooks (OnReady to start the
// polling loop, OnExit to clean up before the process ends). This keeps
// main.go and agentState as the single source of truth for what
// "blocking active" means; the tray only displays it.
package tray

import "time"

// Status is a read-only snapshot of the agent's current state, built by
// agentState (see main.go) and displayed in the tray tooltip and in the
// "View status" menu item. It intentionally carries no secrets (no API
// key, no raw remote config) - only what is safe to show in a tooltip or
// a message box on the user's own screen.
type Status struct {
	// Configured is false until the first successful GET /agent/config
	// (or until IsConfigured=true is returned) - mirrors the "no
	// configuration saved yet" case already logged by tick() in main.go.
	Configured bool
	// Blocking mirrors the last rules.Decision.ShouldBlock.
	Blocking bool
	// LastReason mirrors the last rules.Decision.Reason.
	LastReason string
	// LastPollAt is when the agent last attempted a poll cycle,
	// regardless of whether that poll succeeded.
	LastPollAt time.Time
}

// Config wires the tray to the running agent. All fields are required.
type Config struct {
	// LogPath is the absolute path to agent.log, used by "Open logs".
	// Only populated with a file that actually has content outside
	// -debug mode - see agentLogPath() in main.go.
	LogPath string
	// GetStatus is called on demand (tooltip refresh, "View status"
	// click) and must be safe to call from a goroutine other than the
	// one running agentState.run()/tick() - see agentState.trayStatus
	// in main.go, which guards the underlying fields with a mutex.
	GetStatus func() Status
	// OnReady is called once, in its own goroutine, after the tray icon
	// is showing. It should run the agent's polling loop and only
	// return when that loop is done (context cancelled). The tray
	// implementation calls Quit() itself once OnReady returns, so a
	// shutdown triggered by Ctrl+C or SIGTERM (rather than the "Exit"
	// menu item) still tears down the tray and reaches OnExit.
	OnReady func()
	// OnExit is called exactly once, after Quit() (from the "Exit" menu
	// item or from OnReady returning), before the process exits. This is
	// where hosts.Remove() must still run, matching the cleanup that
	// used to happen unconditionally at the end of main() before the
	// tray existed.
	OnExit func()
}
