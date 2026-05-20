package api

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/mia-clark/frp-manager-server/internal/api/middleware"
	"github.com/mia-clark/frp-manager-server/internal/appcfg"
	"github.com/mia-clark/frp-manager-server/internal/manager"
)

// Deps bundles the collaborators that handlers need.
type Deps struct {
	Cfg     *appcfg.Config
	Logger  *slog.Logger
	Manager *manager.Manager
}

// NewRouter assembles the chi mux with all middleware and route groups
// installed. It returns an http.Handler ready to be served.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Recover(d.Logger))
	r.Use(middleware.AccessLog(d.Logger))
	r.Use(middleware.CORS(d.Cfg.CORSOrigins))

	sys := NewSystemHandler(d.Cfg.DataDir)
	docs := NewDocsHandler(d.Cfg.DocsEnabled)

	// Unauthenticated probes + docs.
	r.Get("/api/v1/health", sys.Health)
	if docs.Enabled() {
		r.Get("/api/docs", docs.Redirect)
		r.Get("/api/docs/", docs.UI)
		r.Get("/api/docs/openapi.yaml", docs.Spec)
		r.Get("/api/docs/openapi.json", docs.SpecJSON)
	}

	configs := NewConfigsHandler(d.Manager, d.Logger)
	proxies := NewProxiesHandler(d.Manager, d.Logger)
	life := NewLifecycleHandler(d.Manager, d.Logger)
	status := NewStatusHandler(d.Manager)
	validate := NewValidateHandler()
	events := NewEventsHandler(d.Manager, d.Logger, d.Cfg.CORSOrigins)
	logs := NewLogsHandler(d.Manager, d.Cfg.LogsDir, d.Logger, d.Cfg.CORSOrigins)
	imex := NewImportExportHandler(d.Manager, d.Logger)
	nat := NewNatholeHandler()

	// Authenticated subtree.
	r.Group(func(r chi.Router) {
		r.Use(middleware.Bearer(d.Cfg.APIToken))
		r.Get("/api/v1/version", sys.Version)

		r.Get("/api/v1/configs", configs.List)
		r.Post("/api/v1/configs", configs.Create)
		r.Post("/api/v1/configs/reorder", configs.Reorder)
		r.Get("/api/v1/configs/{id}", configs.Get)
		r.Put("/api/v1/configs/{id}", configs.Update)
		r.Patch("/api/v1/configs/{id}", configs.Patch)
		r.Delete("/api/v1/configs/{id}", configs.Delete)
		r.Post("/api/v1/configs/{id}/duplicate", configs.Duplicate)
		r.Get("/api/v1/configs/{id}/raw", configs.GetRaw)
		r.Put("/api/v1/configs/{id}/raw", configs.PutRaw)

		r.Get("/api/v1/configs/{id}/proxies", proxies.List)
		r.Post("/api/v1/configs/{id}/proxies", proxies.Create)
		r.Get("/api/v1/configs/{id}/proxies/{name}", proxies.Get)
		r.Put("/api/v1/configs/{id}/proxies/{name}", proxies.Update)
		r.Delete("/api/v1/configs/{id}/proxies/{name}", proxies.Delete)
		r.Post("/api/v1/configs/{id}/proxies/{name}/toggle", proxies.Toggle)

		r.Post("/api/v1/configs/{id}/start", life.Start)
		r.Post("/api/v1/configs/{id}/stop", life.Stop)
		r.Post("/api/v1/configs/{id}/reload", life.Reload)
		r.Get("/api/v1/configs/{id}/status", status.Get)

		r.Post("/api/v1/validate", validate.Validate)

		r.Get("/api/v1/configs/{id}/logs", logs.Query)
		r.Get("/api/v1/configs/{id}/logs/files", logs.Files)
		r.Delete("/api/v1/configs/{id}/logs", logs.Clear)
		r.Get("/api/v1/configs/{id}/logs/tail", logs.Tail)

		r.Get("/api/v1/events", events.Subscribe)

		r.Post("/api/v1/import/file", imex.ImportFile)
		r.Post("/api/v1/import/url", imex.ImportURL)
		r.Post("/api/v1/import/text", imex.ImportText)
		r.Post("/api/v1/import/zip", imex.ImportZIP)
		r.Get("/api/v1/configs/{id}/export", imex.ExportConfig)
		r.Get("/api/v1/export/all", imex.ExportAll)

		r.Post("/api/v1/nathole/discover", nat.Discover)

		r.Get("/api/v1/system/info", sys.Info)
		r.Get("/api/v1/system/cpu", sys.CPU)
		r.Get("/api/v1/system/memory", sys.Memory)
		r.Get("/api/v1/system/disk", sys.Disk)
		r.Get("/api/v1/system/network", sys.Network)
		r.Get("/api/v1/system/connections", sys.Connections)
		r.Get("/api/v1/system/process", sys.Process)
	})

	return r
}
