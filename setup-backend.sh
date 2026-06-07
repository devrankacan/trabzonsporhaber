#!/bin/bash
set -e
cd /var/www/trabzonsporhaber

echo "==> Node.js kontrol ediliyor..."
if ! command -v node &> /dev/null; then
  echo "==> Node.js kuruluyor..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js: $(node -v)"

echo "==> npm bağımlılıkları kuruluyor..."
npm install --production

echo "==> data/ klasörü oluşturuluyor..."
mkdir -p data

echo "==> Systemd servisi oluşturuluyor..."
cat > /etc/systemd/system/habersuperlig-api.service << 'EOF'
[Unit]
Description=Haber Superlig API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/trabzonsporhaber
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable habersuperlig-api
systemctl restart habersuperlig-api
echo "==> API servisi başlatıldı"

echo "==> Nginx /api/ proxy ayarı yapılıyor..."
CONF="/etc/nginx/sites-available/habersuperlig.com"
if grep -q "proxy_pass.*3001" "$CONF"; then
  echo "==> Nginx proxy zaten mevcut"
else
  sed -i 's|location = / {|location /api/ {\n        proxy_pass http://127.0.0.1:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }\n\n    location = / {|' "$CONF"
  nginx -t && systemctl reload nginx
  echo "==> Nginx güncellendi"
fi

echo ""
echo "✓ Backend kurulumu tamamlandı!"
echo "  API: https://habersuperlig.com/api/all"
echo ""
echo "  Şimdi admin paneline gidip 'Sunucuya Yedekle' butonuna tıklayın."
