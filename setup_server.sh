#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Starting zcrAI Server Setup...${NC}"

# 1. Update System
echo -e "${GREEN}[1/5] Updating system packages...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw unzip

# 2. Install Docker
echo -e "${GREEN}[2/5] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "Docker already installed"
fi

# 3. Install Bun
echo -e "${GREEN}[3/5] Installing Bun...${NC}"
if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    # Add to path for this session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    # Persist path
    echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
else
    echo "Bun already installed"
fi

# 4. Setup Firewall
echo -e "${GREEN}[4/5] Configuring Firewall...${NC}"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8000/tcp  # Backend API
ufw allow 8001/tcp  # Collector
ufw allow 8123/tcp  # ClickHouse HTTP
ufw allow 9000/tcp  # ClickHouse Native
ufw allow 5432/tcp  # PostgreSQL (Limited access recommended in prod)
ufw --force enable

# 5. Create Project Directory
echo -e "${GREEN}[5/5] Setting up project directory...${NC}"
mkdir -p /root/zcrAI
cd /root/zcrAI

echo -e "${GREEN}Setup Complete! You can now copy the docker-compose.prod.yml file.${NC}"
echo -e "${GREEN}Run: docker compose -f docker-compose.prod.yml up -d${NC}"
