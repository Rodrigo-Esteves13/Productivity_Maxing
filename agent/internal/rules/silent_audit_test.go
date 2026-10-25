package rules

import (
	"testing"
	"time"

	"pmaxing-agent/internal/apiclient"
)

// Silent audit (area e): tasks created without a time (the task form only
// has a date) are stored at 00:00 UTC of the due day, and the deadline is the
// END of that day (frontend getDeadlineMs / isUtcMidnight, fixed 2026-10-20).
// hasPastDeadline compares the raw timestamp, so with the default
// hasOverdueTasks=true the agent starts blocking apps and sites from 00:00
// UTC of the day the task is due, while the app still shows it as "Today".
func TestDateOnlyTaskDueTodayIsNotOverdue(t *testing.T) {
	now := time.Now().UTC()
	todayMidnightUTC := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	task := apiclient.Task{
		Title:          "Exam today (date only)",
		Date:           todayMidnightUTC,
		ProgressStatus: apiclient.OnTrack,
	}
	decision := Evaluate(
		apiclient.TriggerRules{Mode: apiclient.TriggerAny, HasOverdueTasks: true},
		Snapshot{All: []apiclient.Task{task}},
	)
	if decision.ShouldBlock {
		t.Fatalf("a date-only task due today must not count as overdue yet, got block=true (%s)", decision.Reason)
	}
}
