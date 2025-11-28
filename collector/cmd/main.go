package main

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/zrd4y/zcrAI/collector/internal/config"
	"github.com/zrd4y/zcrAI/collector/internal/publisher"
	"github.com/zrd4y/zcrAI/collector/internal/scheduler"
	"go.uber.org/zap"
)

func main() {
	// โหลด config
	cfg, err := config.Load()
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}
	defer cfg.Logger.Sync()

	cfg.Logger.Info("Starting zcrAI Collector",
		zap.String("elysiaURL", cfg.ElysiaURL),
		zap.String("vectorURL", cfg.VectorURL),
		zap.Duration("pollInterval", cfg.PollInterval),
		zap.Int("lookbackDays", cfg.LookbackDays),
	)

	// สร้าง publisher
	pub := publisher.NewPublisher(cfg.VectorURL, cfg.Logger)

	// สร้าง scheduler
	sched := scheduler.NewScheduler(cfg, pub)
	sched.Start()

	// สร้าง Fiber app
	app := fiber.New(fiber.Config{
		AppName: "zcrAI Collector",
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"service":   "collector",
			"timestamp": c.Context().Time().UTC(),
		})
	})

	// Manual trigger endpoint
	app.Post("/collect/:source", func(c *fiber.Ctx) error {
		source := c.Params("source")

		// รัน async
		go func() {
			if err := sched.RunNow(source); err != nil {
				cfg.Logger.Error("Collection failed", zap.String("source", source), zap.Error(err))
			}
		}()

		return c.JSON(fiber.Map{
			"message": "Collection started",
			"source":  source,
		})
	})

	// Get status
	app.Get("/status", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"scheduler":    "running",
			"pollInterval": cfg.PollInterval.String(),
			"lookbackDays": cfg.LookbackDays,
		})
	})

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		cfg.Logger.Info("Shutting down...")
		sched.Stop()
		app.Shutdown()
	}()

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	cfg.Logger.Info("Collector listening", zap.String("port", port))
	if err := app.Listen(":" + port); err != nil {
		cfg.Logger.Fatal("Failed to start server", zap.Error(err))
	}
}
