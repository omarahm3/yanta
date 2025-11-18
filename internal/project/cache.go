package project

import (
	"context"
	"fmt"
	"sync"
)

type Cache struct {
	cache          sync.Map
	documentCounts sync.Map
	lastDocDates   sync.Map
	store          *Store
}

func NewCache(store *Store) *Cache {
	return &Cache{
		store: store,
	}
}

func (c *Cache) GetByID(ctx context.Context, id string) (*Project, error) {
	if cached, ok := c.cache.Load(id); ok {
		if project, ok := cached.(*Project); ok {
			return project, nil
		}
	}

	project, err := c.store.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	c.cache.Store(id, project)
	return project, nil
}

func (c *Cache) GetByAlias(ctx context.Context, alias string) (*Project, error) {
	var foundProject *Project
	c.cache.Range(func(key, value any) bool {
		if proj, ok := value.(*Project); ok && proj.Alias == alias {
			foundProject = proj
			return false
		}
		return true
	})

	if foundProject != nil {
		return foundProject, nil
	}

	project, err := c.store.GetByAlias(ctx, alias)
	if err != nil {
		return nil, err
	}

	c.cache.Store(project.ID, project)
	return project, nil
}

func (c *Cache) Set(project *Project) {
	if project != nil && project.ID != "" {
		c.cache.Store(project.ID, project)
	}
}

func (c *Cache) Invalidate(id string) {
	c.cache.Delete(id)
}

func (c *Cache) Clear() {
	count := 0
	c.cache.Range(func(key, value any) bool {
		c.cache.Delete(key)
		count++
		return true
	})
}

func (c *Cache) Get(ctx context.Context, ids []string) (map[string]*Project, error) {
	result := make(map[string]*Project, len(ids))
	var missingIDs []string

	for _, id := range ids {
		if cached, ok := c.cache.Load(id); ok {
			if project, ok := cached.(*Project); ok {
				result[id] = project
				continue
			}
		}
		missingIDs = append(missingIDs, id)
	}

	for _, id := range missingIDs {
		project, err := c.store.GetByID(ctx, id)
		if err != nil {
			return nil, err
		}
		result[id] = project
		c.cache.Store(id, project)
	}

	return result, nil
}

func (c *Cache) WarmUp(ctx context.Context, ids []string) error {
	for _, id := range ids {
		_, err := c.GetByID(ctx, id)
		if err != nil {
			return fmt.Errorf("warming up project cache: %w", err)
		}
	}

	return nil
}

func (c *Cache) GetDocumentCount(projectID string) int {
	if count, ok := c.documentCounts.Load(projectID); ok {
		if c, ok := count.(int); ok {
			return c
		}
	}
	return 0
}

func (c *Cache) SetDocumentCount(projectID string, count int) {
	c.documentCounts.Store(projectID, count)
}

func (c *Cache) InvalidateDocumentCount(projectID string) {
	c.documentCounts.Delete(projectID)
}

func (c *Cache) GetLastDocumentDate(projectID string) string {
	if date, ok := c.lastDocDates.Load(projectID); ok {
		if d, ok := date.(string); ok {
			return d
		}
	}
	return ""
}

func (c *Cache) SetLastDocumentDate(projectID string, date string) {
	c.lastDocDates.Store(projectID, date)
}

func (c *Cache) InvalidateLastDocumentDate(projectID string) {
	c.lastDocDates.Delete(projectID)
}
