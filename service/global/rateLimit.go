package global

import (
	"strconv"
	"sync"
	"zpanel/lib/cache"
)

type RateLimiter struct {
	Minute cache.Cacher[int]
	Hour   cache.Cacher[int]
	mu     sync.Mutex
}

func (r *RateLimiter) MinuteAddOnce(userId uint) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := "user_" + strconv.Itoa(int(userId))
	times := r.MinuteGet(userId) + 1
	r.Minute.SetKeepExpiration(key, times)
}

func (r *RateLimiter) MinuteGet(userId uint) int {
	if v, ok := r.Minute.Get("user_" + strconv.Itoa(int(userId))); !ok {
		return 0
	} else {
		return v
	}
}

func (r *RateLimiter) HourAddOnce(userId uint) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := "user_" + strconv.Itoa(int(userId))
	times := r.HourGet(userId) + 1
	r.Hour.SetKeepExpiration(key, times)
}

func (r *RateLimiter) HourGet(userId uint) int {
	if v, ok := r.Hour.Get("user_" + strconv.Itoa(int(userId))); !ok {
		return 0
	} else {
		return v
	}
}
