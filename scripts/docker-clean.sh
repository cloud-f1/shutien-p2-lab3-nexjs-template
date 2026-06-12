#!/usr/bin/env bash
set -euo pipefail

# Docker cleanup with confirmation prompt
# Usage: make docker-clean

echo "🧹 Docker Cleanup"
echo "This will remove:"
echo "  - Stopped containers"
echo "  - Dangling images"
echo "  - Unused networks"
echo ""

read -r -p "Continue? [y/N] " response
if [[ ! "$response" =~ ^[yY]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Pruning containers, images, and networks..."
docker system prune -f

echo ""
read -r -p "Also prune unused volumes? (⚠️  This deletes database data!) [y/N] " vol_response
if [[ "$vol_response" =~ ^[yY]$ ]]; then
    docker volume prune -f
fi

echo ""
echo "✅ Cleanup complete."
docker system df
