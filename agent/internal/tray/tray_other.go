//go:build !windows

package tray

// Run on non-Windows platforms has no tray to show - there is nothing to
// wait on, so it simply runs OnReady synchronously (blocking, same as
// main() did before the tray existed) and then OnExit once it returns.
// This exists only so the project keeps building and testing on
// Linux/macOS during development, mirroring internal/blocker/*_other.go
// and internal/winconsole/winconsole_other.go - the final distribution
// is always the Windows binary.
func Run(cfg Config) {
	if cfg.OnReady != nil {
		cfg.OnReady()
	}
	if cfg.OnExit != nil {
		cfg.OnExit()
	}
}

// Quit is a no-op outside Windows: Run above never blocks waiting for
// it, since there is no tray event loop to unblock.
func Quit() {}
