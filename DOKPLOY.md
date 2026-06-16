Crear archivo: sudo nano /usr/local/bin/update-bus-env.sh
Pegar este contenido:

#------------------------------------------------------------------------------
#!/bin/bash
# Actualiza variables y recrea bus-gateway
# Uso: sudo update-bus-env.sh

# Dokploy escribe el .env en cada redeploy — lo regeneramos desde su API
# Por ahora sincronizar manualmente y recrear el contenedor

ENV_FILE=/etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/.env
COMPOSE_FILE=/etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/code/docker-compose.yml
PROJECT=ips-nodo-dominio-nodo-1uevat

echo "Recreando bus-gateway con variables de $ENV_FILE..."

docker compose \
  --env-file $ENV_FILE \
  -p $PROJECT \
  -f $COMPOSE_FILE \
  up -d --force-recreate --no-deps bus-gateway

echo "Variables activas:"
docker exec bus-gateway env | grep -E "BUS_JWT_SECRET|BUS_ISSUER|BUS_URL|NODO_URL"
#------------------------------------------------------------------------------

Darle permisos: sudo chmod +x /usr/local/bin/update-bus-env.sh

De ahora en adelante el flujo es:
1 — Editar sudo nano /etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/.env
2 — Ejecutar sudo update-bus-env.sh
