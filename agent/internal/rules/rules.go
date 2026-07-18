// Package rules avalia as TriggerRules (vindas de GET /agent/config)
// contra as tasks devolvidas pela API, para decidir se o bloqueio deve
// estar ativo neste ciclo de polling.
package rules

import (
	"time"

	"pmaxing-agent/internal/apiclient"
)

// Snapshot junta o resultado das chamadas à API necessárias para avaliar
// as regras. Mantemos isto separado do apiclient para o motor de regras
// poder ser testado sem fazer pedidos HTTP.
type Snapshot struct {
	Today           []apiclient.Task
	OverdueCheckins []apiclient.Task
	// All: só populado quando HasOverdueTasks ou MinProgressStatus estão
	// ativas (ver main.go) - contém o resultado de GET /tasks sem filtro
	// nenhum.
	All []apiclient.Task
}

// Decision é o resultado da avaliação: se deve bloquear, e uma explicação
// legível para aparecer nos logs.
type Decision struct {
	ShouldBlock bool
	Reason      string
}

// Evaluate aplica as TriggerRules (geridas na página /agent do site) a um
// Snapshot de tasks.
func Evaluate(rules apiclient.TriggerRules, snap Snapshot) Decision {
	var (
		results []bool
		reasons []string
	)

	if rules.HasOverdueCheckins {
		active := len(snap.OverdueCheckins) > 0
		results = append(results, active)
		if active {
			reasons = append(reasons, "there are overdue check-ins pending")
		}
	}

	if rules.MinDifficultyToday != nil {
		threshold := rules.MinDifficultyToday.Rank()
		active := false
		for _, t := range snap.Today {
			if t.Difficulty.Rank() >= threshold {
				active = true
				break
			}
		}
		results = append(results, active)
		if active {
			reasons = append(reasons, "there is a task today with difficulty >= "+string(*rules.MinDifficultyToday))
		}
	}

	if rules.AnyTaskToday {
		active := len(snap.Today) > 0
		results = append(results, active)
		if active {
			reasons = append(reasons, "there are pending tasks today")
		}
	}

	if rules.HasOverdueTasks {
		active := hasPastDeadline(snap.All)
		results = append(results, active)
		if active {
			reasons = append(reasons, "there are tasks past their deadline (regardless of check-in)")
		}
	}

	if rules.MinProgressStatus != nil {
		threshold := rules.MinProgressStatus.Rank()
		active := false
		for _, t := range snap.All {
			if t.ProgressStatus == apiclient.Completed {
				continue
			}
			if t.ProgressStatus.Rank() >= threshold {
				active = true
				break
			}
		}
		results = append(results, active)
		if active {
			reasons = append(reasons, "there is a task with progress >= "+string(*rules.MinProgressStatus))
		}
	}

	if len(results) == 0 {
		// Nenhuma regra ativa na config - por segurança, não bloqueia
		// nada (evita bloqueio permanente por config mal escrita).
		return Decision{ShouldBlock: false, Reason: "no trigger rule is active in the configuration"}
	}

	shouldBlock := combine(rules.Mode, results)
	if !shouldBlock {
		return Decision{ShouldBlock: false, Reason: "no blocking condition is met"}
	}

	reason := reasons[0]
	for _, r := range reasons[1:] {
		reason += "; " + r
	}
	return Decision{ShouldBlock: true, Reason: reason}
}

// hasPastDeadline ativa se existir alguma task não-completada cujo prazo
// exato já passou - comparação direta de timestamps, sem conversão de
// fuso horário nem noção de "dia de calendário". Uma task com deadline às
// 23:00 UTC de ontem conta como overdue mal esse instante passe, mesmo
// que localmente isso ainda caia "dentro do dia de hoje" - é assim que a
// própria app já trata isto (ver o badge "Xh overdue" no dashboard).
func hasPastDeadline(tasks []apiclient.Task) bool {
	now := time.Now()
	for _, t := range tasks {
		if t.ProgressStatus == apiclient.Completed {
			continue
		}
		if t.Date.Before(now) {
			return true
		}
	}
	return false
}

// NeedsAllTasks diz se a config atual precisa de GET /tasks (histórico
// completo) para poder ser avaliada - usado pelo main.go para só fazer
// esse pedido extra quando é mesmo preciso.
func NeedsAllTasks(rules apiclient.TriggerRules) bool {
	return rules.HasOverdueTasks || rules.MinProgressStatus != nil
}

func combine(mode apiclient.TriggerMode, results []bool) bool {
	if mode == apiclient.TriggerAll {
		for _, r := range results {
			if !r {
				return false
			}
		}
		return true
	}
	// TriggerAny (default)
	for _, r := range results {
		if r {
			return true
		}
	}
	return false
}
