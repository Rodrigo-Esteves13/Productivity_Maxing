package rules

import (
	"testing"
	"time"

	"pmaxing-agent/internal/apiclient"
)

func difficultyPtr(d apiclient.Difficulty) *apiclient.Difficulty       { return &d }
func progressPtr(p apiclient.ProgressStatus) *apiclient.ProgressStatus { return &p }

func TestEvaluate_HasOverdueCheckins(t *testing.T) {
	rules := apiclient.TriggerRules{Mode: apiclient.TriggerAny, HasOverdueCheckins: true}

	snap := Snapshot{OverdueCheckins: []apiclient.Task{{ID: "1"}}}
	d := Evaluate(rules, snap)
	if !d.ShouldBlock {
		t.Fatalf("esperava bloqueio ativo com overdue checkins pendentes, veio: %+v", d)
	}

	snap = Snapshot{}
	d = Evaluate(rules, snap)
	if d.ShouldBlock {
		t.Fatalf("não esperava bloqueio sem overdue checkins, veio: %+v", d)
	}
}

func TestEvaluate_MinDifficultyToday(t *testing.T) {
	rules := apiclient.TriggerRules{Mode: apiclient.TriggerAny, MinDifficultyToday: difficultyPtr(apiclient.Hard)}

	snap := Snapshot{Today: []apiclient.Task{{Difficulty: apiclient.Medium}}}
	if d := Evaluate(rules, snap); d.ShouldBlock {
		t.Fatalf("MEDIUM não devia ativar threshold HARD, veio: %+v", d)
	}

	snap = Snapshot{Today: []apiclient.Task{{Difficulty: apiclient.VeryHard}}}
	if d := Evaluate(rules, snap); !d.ShouldBlock {
		t.Fatalf("VERY_HARD devia ativar threshold HARD, veio: %+v", d)
	}
}

func TestEvaluate_ModeAll(t *testing.T) {
	rules := apiclient.TriggerRules{
		Mode:               apiclient.TriggerAll,
		HasOverdueCheckins: true,
		AnyTaskToday:       true,
	}

	snap := Snapshot{OverdueCheckins: []apiclient.Task{{ID: "1"}}}
	if d := Evaluate(rules, snap); d.ShouldBlock {
		t.Fatalf("modo 'all' não devia bloquear com só uma condição verdadeira, veio: %+v", d)
	}

	snap = Snapshot{
		OverdueCheckins: []apiclient.Task{{ID: "1"}},
		Today:           []apiclient.Task{{ID: "2"}},
	}
	if d := Evaluate(rules, snap); !d.ShouldBlock {
		t.Fatalf("modo 'all' devia bloquear com ambas as condições verdadeiras, veio: %+v", d)
	}
}

func TestEvaluate_NoActiveRules(t *testing.T) {
	rules := apiclient.TriggerRules{Mode: apiclient.TriggerAny}
	snap := Snapshot{Today: []apiclient.Task{{ID: "1"}}, OverdueCheckins: []apiclient.Task{{ID: "2"}}}

	d := Evaluate(rules, snap)
	if d.ShouldBlock {
		t.Fatalf("sem regras ativas na config, nunca deve bloquear (fail-safe), veio: %+v", d)
	}
}

func TestEvaluate_HasOverdueTasks_IgnoraCheckinJaConfirmadoHoje(t *testing.T) {
	rules := apiclient.TriggerRules{Mode: apiclient.TriggerAny, HasOverdueTasks: true}
	now := time.Now()
	yesterday := now.AddDate(0, 0, -1)
	checkedInToday := now // lastOverdueCheckAt de hoje já não interessa para esta regra

	snap := Snapshot{
		All: []apiclient.Task{
			{
				Date:               yesterday,
				ProgressStatus:     apiclient.Behind,
				LastOverdueCheckAt: &checkedInToday,
			},
		},
	}

	d := Evaluate(rules, snap)
	if !d.ShouldBlock {
		t.Fatalf("HasOverdueTasks devia ignorar lastOverdueCheckAt e continuar a bloquear, veio: %+v", d)
	}
}

func TestEvaluate_HasOverdueTasks_PrazoJaPassadoHojeConta(t *testing.T) {
	rules := apiclient.TriggerRules{Mode: apiclient.TriggerAny, HasOverdueTasks: true}

	// prazo há 1h atrás, mesmo que caia "hoje" no calendário - conta.
	// Este é o caso real que causava o bug: uma task com deadline
	// perto da meia-noite UTC podia ficar no mesmo dia de calendário
	// local e nunca disparar a regra.
	pastDeadline := time.Now().Add(-1 * time.Hour)

	snap := Snapshot{
		All: []apiclient.Task{
			{Date: pastDeadline, ProgressStatus: apiclient.Behind},
		},
	}

	d := Evaluate(rules, snap)
	if !d.ShouldBlock {
		t.Fatalf("prazo já passado devia ativar o bloqueio independentemente do dia de calendário, veio: %+v", d)
	}
}

func TestEvaluate_HasOverdueTasks_CompletedNaoConta(t *testing.T) {
	rules := apiclient.TriggerRules{Mode: apiclient.TriggerAny, HasOverdueTasks: true}
	yesterday := time.Now().AddDate(0, 0, -1)

	snap := Snapshot{
		All: []apiclient.Task{
			{Date: yesterday, ProgressStatus: apiclient.Completed},
		},
	}

	d := Evaluate(rules, snap)
	if d.ShouldBlock {
		t.Fatalf("task já COMPLETED não devia ativar o bloqueio, veio: %+v", d)
	}
}

func TestEvaluate_MinProgressStatus(t *testing.T) {
	rules := apiclient.TriggerRules{Mode: apiclient.TriggerAny, MinProgressStatus: progressPtr(apiclient.Behind)}

	snap := Snapshot{All: []apiclient.Task{{ProgressStatus: apiclient.OnTrack}}}
	if d := Evaluate(rules, snap); d.ShouldBlock {
		t.Fatalf("ON_TRACK não devia ativar threshold BEHIND, veio: %+v", d)
	}

	snap = Snapshot{All: []apiclient.Task{{ProgressStatus: apiclient.VeryBehind}}}
	if d := Evaluate(rules, snap); !d.ShouldBlock {
		t.Fatalf("VERY_BEHIND devia ativar threshold BEHIND, veio: %+v", d)
	}

	snap = Snapshot{All: []apiclient.Task{{ProgressStatus: apiclient.Completed}}}
	if d := Evaluate(rules, snap); d.ShouldBlock {
		t.Fatalf("COMPLETED nunca devia ativar minProgressStatus, veio: %+v", d)
	}
}

func TestNeedsAllTasks(t *testing.T) {
	if NeedsAllTasks(apiclient.TriggerRules{}) {
		t.Fatal("sem HasOverdueTasks nem MinProgressStatus, não devia precisar de GET /tasks")
	}
	if !NeedsAllTasks(apiclient.TriggerRules{HasOverdueTasks: true}) {
		t.Fatal("com HasOverdueTasks, devia precisar de GET /tasks")
	}
	if !NeedsAllTasks(apiclient.TriggerRules{MinProgressStatus: progressPtr(apiclient.Behind)}) {
		t.Fatal("com MinProgressStatus, devia precisar de GET /tasks")
	}
}
