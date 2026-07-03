package mcp

import (
	"crypto/subtle"
	"net"
	"net/http"
	"net/url"
	"strings"
)

// withAuth wraps an MCP handler with a bearer-token check and an origin guard.
//
// The origin guard rejects requests carrying a non-loopback Origin header,
// which defends against DNS-rebinding attacks where a malicious web page tries
// to reach the local server through the user's browser. Non-browser clients
// (the yanta-mcp shim, direct HTTP clients) send no Origin header and pass.
//
// If token is non-empty, requests must present "Authorization: Bearer <token>".
func withAuth(next http.Handler, token string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" && !isLoopbackOrigin(origin) {
			http.Error(w, "forbidden: non-loopback origin", http.StatusForbidden)
			return
		}
		if token != "" {
			presented := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			if subtle.ConstantTimeCompare([]byte(presented), []byte(token)) != 1 {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func isLoopbackOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
