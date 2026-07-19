//go:build windows

package blocker

import "testing"

func TestIsWildcard(t *testing.T) {
	cases := map[string]bool{
		"steam.exe":    false,
		"discord.exe":  false,
		"*":            true,
		"*.exe":        true,
		"chrome*":      true,
		"notepad?.exe": true,
	}
	for target, want := range cases {
		if got := isWildcard(target); got != want {
			t.Errorf("isWildcard(%q) = %v, want %v", target, got, want)
		}
	}
}

// TestProtectedProcesses_CoversCriticalSystemProcesses cobre o fix de
// segurança: uma lista blockedProcesses maliciosa ou corrompida vinda de
// GET /agent/config nunca deve poder levar a matar um processo crítico
// do sistema - isto testa o denylist diretamente (Enforce em si precisa
// de tasklist/taskkill reais, fora do alcance de um teste unitário).
func TestProtectedProcesses_CoversCriticalSystemProcesses(t *testing.T) {
	mustBeProtected := []string{
		"lsass.exe", "csrss.exe", "winlogon.exe", "wininit.exe",
		"services.exe", "smss.exe", "svchost.exe", "explorer.exe",
		"dwm.exe", "userinit.exe", "system",
	}
	for _, name := range mustBeProtected {
		if !protectedProcesses[name] {
			t.Errorf("%q devia estar no denylist e não está", name)
		}
	}
}
