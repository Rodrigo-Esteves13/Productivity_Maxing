//go:build windows

package tray

import (
	"syscall"
	"unsafe"
)

// We call MessageBoxW directly instead of pulling in a dialog toolkit -
// same reasoning as internal/winconsole/winconsole.go for AllocConsole,
// and the same LazyDLL pattern.
var (
	user32          = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW = user32.NewProc("MessageBoxW")
)

const mbIconInformation = 0x00000040

// showMessageBox displays a native "OK" dialog with the given title and
// body. It is fire-and-forget from the caller's perspective: the call
// runs in its own goroutine so a dialog left open by the user does not
// block the tray's menu event loop, which needs to keep reading from the
// ClickedCh channels for View status/Open logs/Exit.
func showMessageBox(title, text string) {
	titlePtr, err := syscall.UTF16PtrFromString(title)
	if err != nil {
		return
	}
	textPtr, err := syscall.UTF16PtrFromString(text)
	if err != nil {
		return
	}
	go func() {
		_, _, _ = procMessageBoxW.Call(
			0,
			uintptr(unsafe.Pointer(textPtr)),
			uintptr(unsafe.Pointer(titlePtr)),
			mbIconInformation,
		)
	}()
}
