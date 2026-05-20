package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"

	"github.com/mia-clark/frp-manager-server/internal/api/middleware"
	"github.com/mia-clark/frp-manager-server/internal/logtail"
	"github.com/mia-clark/frp-manager-server/internal/manager"
	"github.com/mia-clark/frp-manager-server/pkg/util"
)

// LogsHandler serves /api/v1/configs/{id}/logs*.
type LogsHandler struct {
	m       *manager.Manager
	logsDir string
	log     *slog.Logger
	origins []string
}

// NewLogsHandler builds a LogsHandler.
func NewLogsHandler(m *manager.Manager, logsDir string, log *slog.Logger, origins []string) *LogsHandler {
	return &LogsHandler{m: m, logsDir: logsDir, log: log, origins: origins}
}

func (h *LogsHandler) logPath(id string) string {
	return filepath.Join(h.logsDir, id+".log")
}

// Query returns the last `lines` lines (default 200), or a slice starting
// at `offset` for paging through long logs.
func (h *LogsHandler) Query(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	if !h.m.Exists(id) {
		WriteError(w, http.StatusNotFound, CodeConfigNotFound, "config not found", nil)
		return
	}
	lines := atoiDefault(r.URL.Query().Get("lines"), 200)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 64)
	path := h.logPath(id)
	got, _, next, err := util.ReadFileLines(path, offset, lines)
	if err != nil {
		WriteJSON(w, http.StatusOK, map[string]any{"lines": []string{}, "next_offset": offset})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"lines":       trimLines(got),
		"next_offset": next,
	})
}

// Files lists rotated log files for this config.
func (h *LogsHandler) Files(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	if !h.m.Exists(id) {
		WriteError(w, http.StatusNotFound, CodeConfigNotFound, "config not found", nil)
		return
	}
	files, dates, err := util.FindLogFiles(h.logPath(id))
	if err != nil {
		WriteJSON(w, http.StatusOK, map[string]any{"items": []any{}})
		return
	}
	items := make([]map[string]any, 0, len(files))
	for i, f := range files {
		entry := map[string]any{"path": f}
		if i < len(dates) && !dates[i].IsZero() {
			entry["rotated_at"] = dates[i]
		}
		items = append(items, entry)
	}
	WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

// Clear removes the current and rotated log files for this config.
func (h *LogsHandler) Clear(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	if !h.m.Exists(id) {
		WriteError(w, http.StatusNotFound, CodeConfigNotFound, "config not found", nil)
		return
	}
	if files, _, err := util.FindLogFiles(h.logPath(id)); err == nil {
		util.DeleteFiles(files)
	}
	w.WriteHeader(http.StatusNoContent)
}

// Tail upgrades to WebSocket and streams new lines as they arrive.
func (h *LogsHandler) Tail(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	if !h.m.Exists(id) {
		WriteError(w, http.StatusNotFound, CodeConfigNotFound, "config not found", nil)
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: middleware.IsWildcard(h.origins),
		OriginPatterns:     h.origins,
	})
	if err != nil {
		h.log.Warn("ws accept failed", slog.Any("err", err))
		return
	}
	defer conn.Close(websocket.StatusInternalError, "internal error")

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	t := logtail.New(h.logPath(id))
	ch := t.Subscribe()
	defer t.Stop()

	ping := time.NewTicker(30 * time.Second)
	defer ping.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case line, ok := <-ch:
			if !ok {
				return
			}
			payload, _ := json.Marshal(map[string]string{"line": line})
			wctx, c := context.WithTimeout(ctx, 5*time.Second)
			if err := conn.Write(wctx, websocket.MessageText, payload); err != nil {
				c()
				return
			}
			c()
		case <-ping.C:
			pctx, c := context.WithTimeout(ctx, 5*time.Second)
			if err := conn.Ping(pctx); err != nil {
				c()
				return
			}
			c()
		}
	}
}

func atoiDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return def
	}
	return n
}

func trimLines(in []string) []string {
	out := make([]string, 0, len(in))
	for _, l := range in {
		out = append(out, strings.TrimRight(l, "\r\n"))
	}
	return out
}
