#!/bin/bash
# Y-App Server — VPS Setup Script
# Run on a fresh Ubuntu 24.04 VPS as root:
#   curl -sSL https://raw.githubusercontent.com/OpenAEC-Foundation/Y-app/main/scripts/vps-setup.sh | bash -s YOUR_DOMAIN

set -e

DOMAIN=${1:?"Usage: bash vps-setup.sh api.your-domain.com"}
APP_DIR="/opt/y-app"

echo ""
echo "============================================"
echo "  Y-App Server Setup"
echo "  Domain: $DOMAIN"
echo "============================================"
echo ""

# ─── 1. System updates ───
echo "[1/6] Updating system..."
apt update && apt upgrade -y

# ─── 2. Install Node.js 20 ───
echo "[2/6] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "  Node: $(node -v)"
echo "  npm:  $(npm -v)"

# ─── 3. Install PM2 ───
echo "[3/6] Installing PM2..."
npm install -g pm2

# ─── 4. Create app directory ───
echo "[4/6] Setting up app directory..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/secrets
mkdir -p $APP_DIR/data
cd $APP_DIR

# ─── 4a. Generate the master encryption key (Phase 2 multi-instance) ───
# This file MUST persist across deploys (the deploy pipeline does scp + pm2
# restart and never touches /opt/y-app/secrets/). Loss of this key makes
# every stored ERPNext credential permanently unrecoverable.
MASTER_KEY_FILE="$APP_DIR/secrets/master.key"
if [ ! -f "$MASTER_KEY_FILE" ]; then
  echo "  Generating master encryption key at $MASTER_KEY_FILE"
  openssl rand 32 > "$MASTER_KEY_FILE"
  chmod 600 "$MASTER_KEY_FILE"
  echo "  ⚠  BACK THIS FILE UP. Loss = unable to decrypt any stored credentials."
else
  echo "  Master key already exists at $MASTER_KEY_FILE — keeping it"
fi

# Create a minimal env file (still read by tsx --env-file in dev, ignored
# in prod where ecosystem.config.cjs env wins)
cat > $APP_DIR/.env <<EOF
PORT=3500
# ERPNEXT_LEVEL_MINI=true
# ERPNEXT_LEVEL_CONFIG_DIR=/opt/y-app/data
EOF

# Create PM2 ecosystem file. Multi-instance Phase 5+: no global ERPNEXT_URL
# is needed — instances are stored per-Y-app-user in the SQLite DB. But for
# backwards compat with the legacy single-instance flow we leave it
# commented out so the operator can re-enable it if needed.
cat > $APP_DIR/ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: "y-app-server",
    script: "./server.cjs",
    cwd: "/opt/y-app",
    env: {
      NODE_ENV: "production",
      PORT: 3500,
      // Master encryption key for the multi-instance credential store.
      // MUST point at a stable file outside the deploy directory.
      YAPP_MASTER_KEY_PATH: "/opt/y-app/secrets/master.key",
      // Y-app SQLite location. Defaults to ~/.erpnext-level/sessions.db
      // but pinning it here keeps prod data outside the home directory.
      ERPNEXT_LEVEL_CONFIG_DIR: "/opt/y-app/data",
      // Legacy single-instance flow (only needed if you want to keep the
      // old /api/auth/login route working as a fallback). Multi-instance
      // users do not need this.
      // ERPNEXT_URL: "https://your-erpnext-instance.example.com",
    },
    max_memory_restart: "500M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/opt/y-app/logs/error.log",
    out_file: "/opt/y-app/logs/output.log",
    merge_logs: true,
  }]
};
EOF

mkdir -p $APP_DIR/logs

# ─── 5. Install & configure Nginx ───
echo "[5/6] Installing Nginx..."
apt install -y nginx

cat > /etc/nginx/sites-available/y-app <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Allow forwarded email attachments (base64-encoded in JSON body).
    # Must be >= Express route limit for /api/mail/send.
    client_max_body_size 50m;

    location / {
        proxy_pass http://localhost:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/y-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# ─── 6. SSL via Let's Encrypt ───
echo "[6/6] Setting up SSL..."
apt install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email

# ─── Done ───
# Set PM2 to auto-start on reboot
pm2 startup systemd -u root --hp /root
pm2 save

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  App directory:  $APP_DIR"
echo "  Server URL:     https://$DOMAIN"
echo "  PM2 status:     pm2 status"
echo "  PM2 logs:       pm2 logs y-app-server"
echo ""
echo "  The server will start automatically"
echo "  on first GitHub deploy."
echo ""
echo "  Make sure your DNS points:"
echo "    $DOMAIN → $(curl -s ifconfig.me)"
echo ""
