#!/bin/bash
CONF="/etc/nginx/sites-available/habersuperlig.com"

# Add no-cache headers for HTML files if not already present
if grep -q "Cache-Control" "$CONF"; then
  echo "Cache headers already configured."
else
  sudo sed -i '/location \/ {/a\        add_header Cache-Control "no-cache, no-store, must-revalidate";' "$CONF"
  echo "Added Cache-Control headers."
fi

sudo nginx -t && sudo systemctl reload nginx && echo "Nginx reloaded."
