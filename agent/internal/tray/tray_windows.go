//go:build windows

package tray

import (
	_ "embed"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"fyne.io/systray"
)

// iconData is the tray icon shown in the notification area. It is a
// placeholder in the project's black-and-violet palette (see
// icon/tray.ico) - replace the file and rebuild to use real artwork,
// nothing else needs to change.
//
//go:embed icon/tray.ico
var iconData []byte

// tooltipRefreshInterval controls how often the tooltip text is
// refreshed from GetStatus while the tray is idle (i.e. between clicks).
// This is independent from the agent's own poll interval, which can be
// changed remotely at any time (see agentState.run in main.go) - the
// tray only needs to be "close enough" to current, not exact to the
// second.
const tooltipRefreshInterval = 5 * time.Second

// Run shows the tray icon and blocks until Exit is chosen from the menu
// or Quit() is called from elsewhere (see agentState in main.go, which
// calls Quit() when the polling loop stops for a reason other than the
// user choosing Exit - Ctrl+C in -debug mode, SIGTERM, a Windows logoff).
// It must be called from the goroutine that would otherwise be main()'s
// final blocking call, because systray owns the OS message loop on
// Windows and does not tolerate being driven from a background
// goroutine.
func Run(cfg Config) {
	systray.Run(func() { onReady(cfg) }, cfg.OnExit)
}

// Quit stops the tray and unblocks Run. Safe to call even if the tray
// has already been asked to quit (systray.Quit is documented as safe to
// call multiple times).
func Quit() {
	systray.Quit()
}

func onReady(cfg Config) {
	systray.SetIcon(iconData)
	systray.SetTitle("PMaxing Agent")
	refreshTooltip(cfg.GetStatus)

	mStatus := systray.AddMenuItem("View status", "Show the last decision and when the agent last polled")
	systray.AddSeparator()
	mLogs := systray.AddMenuItem("Open logs", "Open the agent log file")
	systray.AddSeparator()
	mExit := systray.AddMenuItem("Exit", "Stop the agent and remove any active domain block")

	// The polling loop itself only starts now, once the tray icon is
	// actually visible - this mirrors the ordering the previous
	// (tray-less) main() used, where the first log line ("starting up -
	// fetching configuration from...") was already printed before this
	// point. cfg.OnReady blocks until the agent's context is cancelled;
	// when it returns we tear the tray down ourselves so a shutdown that
	// did not go through the "Exit" menu item still reaches cfg.OnExit.
	go func() {
		cfg.OnReady()
		Quit()
	}()

	go tooltipLoop(cfg.GetStatus)

	for {
		select {
		case <-mStatus.ClickedCh:
			showStatus(cfg.GetStatus())
		case <-mLogs.ClickedCh:
			openLogs(cfg.LogPath)
		case <-mExit.ClickedCh:
			// systray delivers the click, then we call Quit ourselves;
			// cfg.OnExit (hosts.Remove(), see main.go) runs as the
			// second argument passed to systray.Run above.
			Quit()
			return
		}
	}
}

func tooltipLoop(getStatus func() Status) {
	ticker := time.NewTicker(tooltipRefreshInterval)
	defer ticker.Stop()
	for range ticker.C {
		refreshTooltip(getStatus)
	}
}

func refreshTooltip(getStatus func() Status) {
	systray.SetTooltip(tooltipText(getStatus()))
}

func tooltipText(s Status) string {
	switch {
	case !s.Configured:
		return "PMaxing Agent, not configured yet"
	case s.Blocking:
		return "PMaxing Agent, blocking active"
	default:
		return "PMaxing Agent, idle"
	}
}

func showStatus(s Status) {
	title := "PMaxing Agent - status"
	body := "Blocking: " + blockingLabel(s.Blocking) +
		"\r\nLast poll: " + pollLabel(s.LastPollAt) +
		"\r\nReason: " + reasonLabel(s.LastReason)
	// showMessageBox (winmsg_windows.go) runs the dialog in its own
	// goroutine, so a message box left open by the user does not freeze
	// the tray's menu (mStatus/mLogs/mExit ClickedCh above).
	showMessageBox(title, body)
}

func blockingLabel(blocking bool) string {
	if blocking {
		return "active"
	}
	return "idle"
}

func pollLabel(t time.Time) string {
	if t.IsZero() {
		return "never yet"
	}
	return t.Format("2006-01-02 15:04:05")
}

func reasonLabel(reason string) string {
	if reason == "" {
		return "no decision recorded yet"
	}
	return reason
}

// openLogs opens agent.log with the OS default handler. In -debug mode
// the agent logs to a live console instead of this file (see
// setupLogging in main.go), so the file may not exist yet or may be
// stale - in that case we fall back to opening the containing folder,
// which still gives the user somewhere useful to land instead of a
// silent failure.
func openLogs(path string) {
	target := path
	if _, err := os.Stat(path); err != nil {
		target = filepath.Dir(path)
	}
	_ = exec.Command("explorer", target).Start()
}
