//go:build windows

// Package singleinstance impede que duas instâncias do agente corram ao
// mesmo tempo na mesma máquina. Sem isto, duas instâncias fazem
// readWithoutManagedBlock + writeAtomic (ver internal/blocker/hosts.go)
// em paralelo, sem qualquer coordenação entre elas - uma pode ler o
// hosts file, a outra escrever por cima, e a primeira escrever a seguir
// com base numa versão já desatualizada, apagando a alteração da segunda
// ou deixando o bloco gerido inconsistente. Isto pode acontecer
// facilmente na prática: duplo-clique acidental no .exe enquanto a
// primeira instância ainda está a arrancar, ou uma entrada no Task
// Scheduler ("At log on") a disparar ao mesmo tempo que o utilizador já
// tinha aberto o agente manualmente.
package singleinstance

import (
	"fmt"
	"syscall"
	"unsafe"
)

const mutexName = `Global\PMaxingAgentSingleInstance`

const errorAlreadyExists = 183 // ERROR_ALREADY_EXISTS

var (
	kernel32         = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutexW = kernel32.NewProc("CreateMutexW")
	procReleaseMutex = kernel32.NewProc("ReleaseMutex")
	procCloseHandle  = kernel32.NewProc("CloseHandle")
)

// Acquire tenta obter o lock exclusivo de "só uma instância" via um
// mutex nomeado do Windows. "Global\" no nome (em vez de "Local\") é
// importante: o agente corre tipicamente elevado a partir do Task
// Scheduler no logon, mas também pode ser arrancado manualmente por um
// utilizador - sem o prefixo Global, cada sessão veria o seu próprio
// mutex e duas instâncias em sessões diferentes não se veriam uma à
// outra.
//
// Devolve:
//   - release: chamar (via defer) quando o agente terminar, para
//     libertar o lock. Nunca nil.
//   - alreadyRunning: true se já havia outra instância viva a segurar o
//     lock - o chamador deve terminar sem tocar no hosts file nem em
//     process blocking.
//   - err: só para falhas inesperadas do próprio Windows ao criar o
//     mutex (não para "já há outra instância" - isso é
//     alreadyRunning=true, err=nil).
func Acquire() (release func(), alreadyRunning bool, err error) {
	namePtr, convErr := syscall.UTF16PtrFromString(mutexName)
	if convErr != nil {
		return func() {}, false, fmt.Errorf("could not encode mutex name: %w", convErr)
	}

	handle, _, callErr := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(namePtr)))
	if handle == 0 {
		return func() {}, false, fmt.Errorf("CreateMutexW failed: %w", callErr)
	}

	// CreateMutexW ainda devolve um handle válido quando o mutex já
	// existia - GetLastError() é que distingue "criei agora" de "já
	// existia e só abri uma referência a ele". syscall.Call() já
	// devolve esse último erro do sistema em callErr (via
	// GetLastError logo a seguir à chamada), por isso comparamos o
	// código de erro Windows, não callErr == nil.
	if errno, ok := callErr.(syscall.Errno); ok && errno == errorAlreadyExists {
		procCloseHandle.Call(handle)
		return func() {}, true, nil
	}

	release = func() {
		procReleaseMutex.Call(handle)
		procCloseHandle.Call(handle)
	}
	return release, false, nil
}
