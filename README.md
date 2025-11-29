backend\api
bun install
firt time run: bun run db:setup #migrate + seed
bun run dev

- **Backend**: `bun run dev` (Auto-reload on changes)

bunx drizzle-kit generate

collector\cmd
go mod tidy
go run main.go

frontend
bun install
bun run dev

docker-compose -f docker-compose-dev.yml up --build -d
