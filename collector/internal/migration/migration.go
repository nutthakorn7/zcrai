package migration

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/ClickHouse/clickhouse-go/v2"
	"go.uber.org/zap"
)

type Config struct {
	Host     string
	Port     string
	Database string
	Username string
	Password string
	MigrationsDir string
	Logger   *zap.Logger
}

func Run(cfg Config) error {
	dsn := fmt.Sprintf("clickhouse://%s:%s@%s:%s/%s?debug=false",
		cfg.Username, cfg.Password, cfg.Host, cfg.Port, cfg.Database)

	db, err := sql.Open("clickhouse", dsn)
	if err != nil {
		return fmt.Errorf("failed to open clickhouse connection: %w", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping clickhouse: %w", err)
	}

	cfg.Logger.Info("Connected to ClickHouse for migration")

	// 1. Create schema_migrations table
	if err := createMigrationTable(db); err != nil {
		return err
	}

	// 2. Get applied migrations
	applied, err := getAppliedMigrations(db)
	if err != nil {
		return err
	}

	// 3. Get migration files
	files, err := getMigrationFiles(cfg.MigrationsDir)
	if err != nil {
		return err
	}

	// 4. Apply new migrations
	for _, file := range files {
		if applied[file] {
			continue
		}

		cfg.Logger.Info("Applying migration", zap.String("file", file))
		if err := applyMigration(db, filepath.Join(cfg.MigrationsDir, file)); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", file, err)
		}

		if err := recordMigration(db, file); err != nil {
			return fmt.Errorf("failed to record migration %s: %w", file, err)
		}
		cfg.Logger.Info("Migration applied successfully", zap.String("file", file))
	}

	cfg.Logger.Info("All migrations applied")
	return nil
}

func createMigrationTable(db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version String,
			applied_at DateTime DEFAULT now()
		) ENGINE = TinyLog
	`
	_, err := db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}
	return nil
}

func getAppliedMigrations(db *sql.DB) (map[string]bool, error) {
	rows, err := db.Query("SELECT version FROM schema_migrations")
	if err != nil {
		return nil, fmt.Errorf("failed to query applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}
	return applied, nil
}

func getMigrationFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory %s: %w", dir, err)
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)
	return files, nil
}

func applyMigration(db *sql.DB, path string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	// Split commands by ; (basic implementation, might need robust parsing for complex logic)
	// For ClickHouse, sending the whole file usually works if it's a script, but clickhouse-go might expect single statements.
	// Let's try Exec'ing the whole content first. If it fails, we might need to split.
	// ClickHouse generally supports multi-statement if configured, but let's split by default to be safe for standard DDLs.
	// UPDATE: Split by ; might break if ; is inside strings.
	// Let's try executing the whole block.
	
	queries := strings.Split(string(content), ";")
	for _, query := range queries {
		query = strings.TrimSpace(query)
		if query == "" {
			continue
		}
		if _, err := db.Exec(query); err != nil {
			return fmt.Errorf("error executing query: %s, err: %w", query, err)
		}
	}

	return nil
}

func recordMigration(db *sql.DB, version string) error {
	_, err := db.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version)
	return err
}
