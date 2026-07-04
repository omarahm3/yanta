package document

// PropInt reads an integer block prop, tolerating both the float64 that JSON
// unmarshaling produces and the int that hand-authored (seed) blocks carry.
// Reading `props[key].(float64)` alone silently falls back to the default for
// seed blocks that never round-tripped through JSON.
func PropInt(props map[string]any, key string, def int) int {
	if props == nil {
		return def
	}
	switch v := props[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	default:
		return def
	}
}

func PropString(props map[string]any, key, def string) string {
	if props == nil {
		return def
	}
	if s, ok := props[key].(string); ok {
		return s
	}
	return def
}

func PropBool(props map[string]any, key string, def bool) bool {
	if props == nil {
		return def
	}
	if b, ok := props[key].(bool); ok {
		return b
	}
	return def
}
