//go:build !windows

package singleinstance

// Acquire outside Windows always succeeds and reports no other instance
// running - there is no lock primitive used here worth stubbing, since
// this package only exists to serialize access to the Windows hosts file
// path (see internal/blocker/paths_windows.go); the /etc/hosts path used
// on other platforms is dev/test-only (see paths_other.go).
func Acquire() (release func(), alreadyRunning bool, err error) {
	return func() {}, false, nil
}
