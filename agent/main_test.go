package main

import (
	"strings"
	"testing"

	"pmaxing-agent/internal/rules"
)

// TestBuildKeptDecision_DoesNotAccumulateAcrossCycles é a regressão do bug
// real: tick() costumava gravar a Decision já anotada de volta em
// a.lastDecision, fazendo o sufixo "(kept: ...)" empilhar-se sem limite a
// cada ciclo em que a API de tasks continuasse inacessível (chegou a um
// Reason com centenas de repetições do mesmo sufixo, ver histórico real).
// Este teste simula exatamente esse cenário: chama buildKeptDecision
// repetidamente a partir do MESMO `last` (tal como tick() agora faz,
// nunca reatribuindo a.lastDecision nesta branch), e confirma que o
// comprimento do Reason não cresce entre chamadas.
func TestBuildKeptDecision_DoesNotAccumulateAcrossCycles(t *testing.T) {
	lastGood := rules.Decision{ShouldBlock: true, Reason: "there are tasks past their deadline"}

	var firstLen int
	for cycle := 0; cycle < 50; cycle++ {
		kept := buildKeptDecision(lastGood)
		if cycle == 0 {
			firstLen = len(kept.Reason)
		} else if len(kept.Reason) != firstLen {
			t.Fatalf("cycle %d: Reason length changed (%d -> %d) - está a acumular: %q",
				cycle, firstLen, len(kept.Reason), kept.Reason)
		}
		if strings.Count(kept.Reason, "(kept:") != 1 {
			t.Fatalf("cycle %d: esperava exatamente uma anotação '(kept:', encontrei %d: %q",
				cycle, strings.Count(kept.Reason, "(kept:"), kept.Reason)
		}
	}
}

func TestBuildKeptDecision_PreservesShouldBlockAndReason(t *testing.T) {
	last := rules.Decision{ShouldBlock: true, Reason: "there are pending tasks today"}
	kept := buildKeptDecision(last)

	if kept.ShouldBlock != true {
		t.Errorf("ShouldBlock = %v, esperava true (preservado de last)", kept.ShouldBlock)
	}
	if !strings.HasPrefix(kept.Reason, "there are pending tasks today") {
		t.Errorf("Reason não preserva a razão original: %q", kept.Reason)
	}
	if !strings.Contains(kept.Reason, "kept: API unreachable, failMode=CLOSED") {
		t.Errorf("Reason não tem a anotação esperada: %q", kept.Reason)
	}
}

func TestBuildKeptDecision_NoPreviousDecisionYet(t *testing.T) {
	kept := buildKeptDecision(rules.Decision{}) // zero-value: nunca houve decide() com sucesso
	if !strings.HasPrefix(kept.Reason, "no previous decision known yet") {
		t.Errorf("esperava fallback para Reason vazio, obtive: %q", kept.Reason)
	}
}
