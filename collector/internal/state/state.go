package state

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// StateResponse จาก API
type StateResponse struct {
	ID               string         `json:"id"`
	TenantID         string         `json:"tenantId"`
	Provider         string         `json:"provider"`
	URLHash          string         `json:"urlHash"`
	Checkpoint       *time.Time     `json:"checkpoint"`
	FullSyncAt       *time.Time     `json:"fullSyncAt"`
	FullSyncComplete bool           `json:"fullSyncComplete"`
	EventCount       map[string]int `json:"eventCount"`
}

// State จัดการ checkpoint ผ่าน API (PostgreSQL)
type State struct {
	apiURL       string
	collectorKey string
	cache        map[string]*StateResponse // key = tenantId:provider:urlHash
	mutex        sync.RWMutex
}

func NewState(apiURL, collectorKey string) *State {
	return &State{
		apiURL:       apiURL,
		collectorKey: collectorKey,
		cache:        make(map[string]*StateResponse),
	}
}

// cacheKey สร้าง unique key สำหรับ cache
func cacheKey(tenantID, provider, urlHash string) string {
	return fmt.Sprintf("%s:%s:%s", tenantID, provider, urlHash)
}

// GetState ดึง state จาก API (มี cache)
func (s *State) GetState(tenantID, provider, urlHash string) (*StateResponse, error) {
	key := cacheKey(tenantID, provider, urlHash)

	// Check cache first
	s.mutex.RLock()
	if cached, ok := s.cache[key]; ok {
		s.mutex.RUnlock()
		return cached, nil
	}
	s.mutex.RUnlock()

	// Fetch from API (Elysia route: /integrations/collector/state)
	url := fmt.Sprintf("%s/integrations/collector/state?tenantId=%s&provider=%s&urlHash=%s",
		s.apiURL, tenantID, provider, urlHash)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-collector-key", s.collectorKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // No state found
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error: %d", resp.StatusCode)
	}

	// API returns { state: ... }
	var result struct {
		State *StateResponse `json:"state"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// state อาจเป็น null ถ้าไม่มี record
	if result.State == nil {
		return nil, nil
	}

	// Cache result
	s.mutex.Lock()
	s.cache[key] = result.State
	s.mutex.Unlock()

	return result.State, nil
}

// UpdateState อัพเดท state ผ่าน API
func (s *State) UpdateState(tenantID, provider, urlHash string, checkpoint *time.Time, fullSyncComplete bool) error {
	payload := map[string]interface{}{
		"tenantId":         tenantID,
		"provider":         provider,
		"urlHash":          urlHash,
		"fullSyncComplete": fullSyncComplete,
	}
	if checkpoint != nil {
		payload["checkpoint"] = checkpoint.Format(time.RFC3339)
	}
	if fullSyncComplete {
		now := time.Now()
		payload["fullSyncAt"] = now.Format(time.RFC3339)
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/integrations/collector/state", s.apiURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-collector-key", s.collectorKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API error: %d", resp.StatusCode)
	}

	// Invalidate cache
	key := cacheKey(tenantID, provider, urlHash)
	s.mutex.Lock()
	delete(s.cache, key)
	s.mutex.Unlock()

	return nil
}

// HasFullSync เช็คว่าเคย full sync สำเร็จหรือยัง
func (s *State) HasFullSync(tenantID, provider, urlHash string) bool {
	state, err := s.GetState(tenantID, provider, urlHash)
	if err != nil || state == nil {
		return false
	}
	return state.FullSyncComplete
}

// GetCheckpoint ดึง checkpoint ล่าสุด
func (s *State) GetCheckpoint(tenantID, provider, urlHash string) *time.Time {
	state, err := s.GetState(tenantID, provider, urlHash)
	if err != nil || state == nil {
		return nil
	}
	return state.Checkpoint
}

// UpdateCheckpoint อัพเดท checkpoint
func (s *State) UpdateCheckpoint(tenantID, provider, urlHash string, checkpoint time.Time) error {
	return s.UpdateState(tenantID, provider, urlHash, &checkpoint, false)
}

// SetFullSync บันทึกว่า full sync เสร็จ
func (s *State) SetFullSync(tenantID, provider, urlHash string) error {
	now := time.Now()
	return s.UpdateState(tenantID, provider, urlHash, &now, true)
}

// ClearCache ล้าง cache (ใช้เมื่อต้องการ refresh)
func (s *State) ClearCache() {
	s.mutex.Lock()
	s.cache = make(map[string]*StateResponse)
	s.mutex.Unlock()
}
