// Package resourceguard coordinates writes to files and their URL-based references
// within a single server. It does not coordinate multiple server processes.
package resourceguard

import "sync"

var mutationMu sync.Mutex

// LockMutation returns the unlock function. Parse uploads before acquiring it so
// slow clients cannot block settings saves or file deletion.
func LockMutation() func() {
	mutationMu.Lock()
	return mutationMu.Unlock
}
