package transport

import (
	"context"
	_ "embed"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/coder/websocket"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed websocket-transport.js
var jsClient []byte

// WebSocketTransport provides WebSocket-based IPC for browser dev mode.
// Adapted from the Wails v3 websocket-transport example, using coder/websocket
// instead of gorilla/websocket.
//
// This is NOT production-ready — it's for local development only,
// allowing access to the Wails app from a browser alongside the desktop window.
type WebSocketTransport struct {
	addr    string
	server  *http.Server
	clients map[*websocket.Conn]chan *WebSocketMessage
	mu      sync.RWMutex
	handler *application.MessageProcessor
}

// wsResponse represents the response to a runtime call.
type wsResponse struct {
	StatusCode int `json:"statusCode"`
	Data       any `json:"data"`
}

// WebSocketMessage represents a message sent over the WebSocket transport.
type WebSocketMessage struct {
	ID       string                      `json:"id"`
	Type     string                      `json:"type"` // "request", "response", or "event"
	Request  *application.RuntimeRequest `json:"request,omitempty"`
	Response *wsResponse                 `json:"response,omitempty"`
	Event    *application.CustomEvent    `json:"event,omitempty"`
}

// NewWebSocketTransport creates a new WebSocket transport listening on the given address.
// Example: NewWebSocketTransport(":34116")
func NewWebSocketTransport(addr string) *WebSocketTransport {
	return &WebSocketTransport{
		addr:    addr,
		clients: make(map[*websocket.Conn]chan *WebSocketMessage),
	}
}

// Start initialises the transport (called by Wails on app start).
func (w *WebSocketTransport) Start(ctx context.Context, handler *application.MessageProcessor) error {
	w.handler = handler

	w.server = &http.Server{
		Addr: w.addr,
	}

	go func() {
		<-ctx.Done()
		w.Stop()
	}()

	return nil
}

// JSClient returns the embedded JavaScript transport client.
func (w *WebSocketTransport) JSClient() []byte {
	return jsClient
}

// ServeAssets configures the HTTP server to serve both assets and WebSocket IPC.
func (w *WebSocketTransport) ServeAssets(assetHandler http.Handler) error {
	mux := http.NewServeMux()

	mux.HandleFunc("/wails/ws", w.handleWebSocket)
	mux.Handle("/", assetHandler)

	w.server.Handler = mux

	go func() {
		log.Printf("[BrowserDev] Serving on http://localhost%s", w.addr)
		log.Printf("[BrowserDev] WebSocket IPC on ws://localhost%s/wails/ws", w.addr)
		if err := w.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[BrowserDev] Server error: %v", err)
		}
	}()

	return nil
}

// Stop gracefully shuts down the transport.
func (w *WebSocketTransport) Stop() error {
	if w.server == nil {
		return nil
	}

	w.mu.Lock()
	for conn := range w.clients {
		conn.Close(websocket.StatusGoingAway, "server shutting down")
	}
	w.mu.Unlock()

	return w.server.Shutdown(context.Background())
}

// handleWebSocket handles incoming WebSocket connections.
func (w *WebSocketTransport) handleWebSocket(rw http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(rw, r, &websocket.AcceptOptions{
		// Dev mode only — accept any origin.
		InsecureSkipVerify: true,
	})
	if err != nil {
		log.Printf("[BrowserDev] WebSocket accept failed: %v", err)
		return
	}

	w.mu.Lock()
	messageChan := make(chan *WebSocketMessage, 100)
	w.clients[conn] = messageChan
	w.mu.Unlock()

	ctx, cancel := context.WithCancel(r.Context())

	defer func() {
		w.mu.Lock()
		cancel()
		close(messageChan)
		delete(w.clients, conn)
		w.mu.Unlock()
		conn.Close(websocket.StatusNormalClosure, "")
	}()

	// Writer goroutine — serialises all writes to this connection.
	go func() {
		for {
			select {
			case msg, ok := <-messageChan:
				if !ok {
					return
				}
				data, err := json.Marshal(msg)
				if err != nil {
					log.Printf("[BrowserDev] Failed to marshal message: %v", err)
					continue
				}
				if err := conn.Write(ctx, websocket.MessageText, data); err != nil {
					log.Printf("[BrowserDev] Failed to send message: %v", err)
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	// Reader loop — reads messages from the client.
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			status := websocket.CloseStatus(err)
			if status != websocket.StatusNormalClosure && status != websocket.StatusGoingAway {
				log.Printf("[BrowserDev] WebSocket read error: %v", err)
			}
			break
		}

		var msg WebSocketMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("[BrowserDev] Failed to unmarshal message: %v", err)
			continue
		}

		if msg.Type == "request" && msg.Request != nil {
			if msg.Request.Args == nil {
				msg.Request.Args = &application.Args{}
			}
			go w.handleRequest(ctx, messageChan, msg.ID, msg.Request)
		}
	}
}

// handleRequest processes a runtime call and sends the response back.
func (w *WebSocketTransport) handleRequest(ctx context.Context, messageChan chan *WebSocketMessage, msgID string, req *application.RuntimeRequest) {
	response, err := w.handler.HandleRuntimeCallWithIDs(ctx, req)
	w.sendResponse(ctx, messageChan, msgID, response, err)
}

// sendResponse sends a response to the client.
func (w *WebSocketTransport) sendResponse(ctx context.Context, messageChan chan *WebSocketMessage, msgID string, resp any, err error) {
	response := &wsResponse{
		StatusCode: 200,
		Data:       resp,
	}
	if err != nil {
		response.StatusCode = 422
		response.Data = err.Error()
	}

	responseMsg := &WebSocketMessage{
		ID:       msgID,
		Type:     "response",
		Response: response,
	}

	w.mu.RLock()
	defer w.mu.RUnlock()

	select {
	case <-ctx.Done():
		log.Println("[BrowserDev] Context cancelled before sending response.")
	default:
		messageChan <- responseMsg
	}
}

// DispatchWailsEvent sends an event to all connected browser clients.
func (w *WebSocketTransport) DispatchWailsEvent(event *application.CustomEvent) {
	msg := &WebSocketMessage{
		Type:  "event",
		Event: event,
	}

	w.mu.RLock()
	defer w.mu.RUnlock()

	for _, channel := range w.clients {
		channel <- msg
	}
}
