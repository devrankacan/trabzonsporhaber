#!/bin/bash
CONF="/etc/nginx/sites-available/habersuperlig.com"

if grep -q "error_page 404" "$CONF"; then
  echo "404 already configured."
else
  sudo sed -i '/server_name/a\    error_page 404 /404.html;' "$CONF"
  echo "Added error_page 404 directive."
fi

sudo nginx -t && sudo systemctl reload nginx && echo "Nginx reloaded successfully."
