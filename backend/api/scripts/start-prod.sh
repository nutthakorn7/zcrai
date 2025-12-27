#!/bin/bash
# robust-start.sh: The single source of truth for starting the backend
# Usage: ./robust-start.sh

cd "$(dirname "$0")/.." || exit 1

# Ensure we are in backend/api
if [ ! -f "index.ts" ]; then
    echo "❌ Error: index.ts not found in $(pwd)"
    exit 1
fi

echo "🚀 Starting zcrAI Backend with Bun..."
echo "📂 Working Directory: $(pwd)"

# Setup Environment ensures Bun works correctly
export NODE_ENV=production

# Run with bun directly - no PM2 interpretation layers
exec bun run index.ts
