package state

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

type State struct {
	LastFullSync map[string]time.Time `json:"last_full_sync"`
	mutex        sync.RWMutex
}

func NewState() *State {
	return &State{
		LastFullSync: make(map[string]time.Time),
	}
}

func (s *State) Load(path string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // File not found is OK
		}
		return err
	}

	return json.Unmarshal(data, s)
}

func (s *State) Save(path string) error {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

func (s *State) HasFullSync(tenantID string) bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	_, ok := s.LastFullSync[tenantID]
	return ok
}

func (s *State) SetFullSync(tenantID string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.LastFullSync[tenantID] = time.Now()
}

// GetCheckpoint ดึงเวลาล่าสุดที่ sync สำเร็จ (ถ้าไม่มี return zero time)
func (s *State) GetCheckpoint(tenantID string) time.Time {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.LastFullSync[tenantID]
}

// UpdateCheckpoint อัพเดทเวลาล่าสุดที่ sync
func (s *State) UpdateCheckpoint(tenantID string, checkpoint time.Time) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	// Update only if newer
	if current, ok := s.LastFullSync[tenantID]; !ok || checkpoint.After(current) {
		s.LastFullSync[tenantID] = checkpoint
	}
}
