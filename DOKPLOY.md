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

#-------------------------------------------------------------------------------
docker-compose.yml (para dokploy)
services:

  hapi-db:
    container_name: hapi-db
    image: "postgres:14.6"
    restart: always
    user: root
    environment:
      TZ: ${TZ:-America/Argentina/Buenos_Aires}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - hapi-data:/var/lib/postgresql/data
    networks:
      - hapi-network
    healthcheck:
      test: [ "CMD-SHELL", "pg_isready -p 5433" ]
      interval: 20s
      timeout: 10s
      retries: 5
    command: -p 5433

  hapi-fhir:
    container_name: hapi-fhir
    image: "hapiproject/hapi:latest"
    depends_on:
      hapi-db:
        condition: service_healthy
    volumes:
      - ./hapi-config:/data/hapi
    environment:
      TZ: ${TZ:-America/Argentina/Buenos_Aires}
      SPRING_CONFIG_LOCATION: ${SPRING_CONFIG_LOCATION}
      SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL}
      SPRING_DATASOURCE_USERNAME: ${SPRING_DATASOURCE_USERNAME}
      SPRING_DATASOURCE_PASSWORD: ${SPRING_DATASOURCE_PASSWORD}
      SPRING_DATASOURCE_DRIVERCLASSNAME: ${SPRING_DATASOURCE_DRIVERCLASSNAME}
      SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT: ${SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT}
    networks:
      - hapi-network
      - dokploy-network
    labels:
      - traefik.enable=true
      - traefik.http.routers.hapi-fhir.rule=Host(`ipsgarrahan.fgnu.ar`) && PathPrefix(`/fhir`)
      - traefik.http.routers.hapi-fhir.entrypoints=websecure
      - traefik.http.routers.hapi-fhir.priority=100
      - traefik.http.routers.hapi-fhir.service=hapi-fhir
      - traefik.http.services.hapi-fhir.loadbalancer.server.port=8080
      - traefik.docker.network=dokploy-network
      - traefik.http.routers.hapi-fhir-root.rule=Host(`ipsgarrahan.fgnu.ar`)
      - traefik.http.routers.hapi-fhir-root.entrypoints=websecure
      - traefik.http.routers.hapi-fhir-root.priority=1
      - traefik.http.routers.hapi-fhir-root.service=hapi-fhir-root
      - traefik.http.services.hapi-fhir-root.loadbalancer.server.port=8080

  bus-gateway:
    container_name: bus-gateway
    depends_on:
      hapi-fhir:
        condition: service_started
    build:
      context: ./bus-gateway
    environment:
      TZ: ${TZ:-America/Argentina/Buenos_Aires}
      NODO_URL_BASE: ${NODO_URL_BASE:-http://ipsgarrahan.fgnu.ar}
      BUS_URL: ${BUS_URL}
      BUS_JWT_SECRET: ${BUS_JWT_SECRET}
      BUS_ISSUER: ${BUS_ISSUER}
      MPI_URL: ${MPI_URL}
      DOCUMENT_REGISTRY_URL: ${DOCUMENT_REGISTRY_URL}
      MPI_SCOPE: ${MPI_SCOPE}
      DOCUMENT_REGISTRY_SCOPE: ${DOCUMENT_REGISTRY_SCOPE}
      FHIR_URL: http://hapi-fhir:8080/fhir
      BUS_DEBUG: ${BUS_DEBUG}
    networks:
      - hapi-network
      - dokploy-network
    labels:
      - traefik.enable=true
      - traefik.http.routers.bus-gateway.rule=Host(`ipsgarrahan.fgnu.ar`) && (PathPrefix(`/fhir/IPSTransaction`) || PathPrefix(`/fhir/IPSDocument`) || PathPrefix(`/fhir/DocumentReference`) || PathPrefix(`/fhir/Patient`))
      - traefik.http.routers.bus-gateway.entrypoints=websecure
      - traefik.http.routers.bus-gateway.priority=200
      - traefik.http.services.bus-gateway.loadbalancer.server.port=3000
      - traefik.docker.network=dokploy-network
networks:
  hapi-network:
    name: hapi-network
  dokploy-network:
    external: true

volumes:
  hapi-data:
    name: hapi-data
    driver: local

#-------------------------------------------------------------------------------
.env (ejemplo para dokploy)
# =============================================================================
# IPS Nodo Dominio — Variables de entorno
# =============================================================================

# =============================================================================
# NODO
# =============================================================================

NODO_URL_BASE=https://ipsgarrahan.fgnu.ar
TZ=America/Argentina/Buenos_Aires

# =============================================================================
# BUS DE SALUD — Requeridas
# =============================================================================

BUS_URL=https://bus-test.msal.gob.ar
BUS_JWT_SECRET=z9pKa5gAYG6P3L0GsdW58s4sY
BUS_ISSUER=https://www.garrahan.gov.ar

MPI_SCOPE=Patient/*.read,Patient/*.write
DOCUMENT_REGISTRY_SCOPE=DocumentReference/*.read,DocumentReference/*.write

# =============================================================================
# BUS DE SALUD — Opcionales
# =============================================================================

MPI_URL=https://bus-test.msal.gob.ar/masterfile-federacion-service/fhir/Patient
DOCUMENT_REGISTRY_URL=https://bus-test.msal.gob.ar/fhir/DocumentReference
BUS_DEBUG=false

# =============================================================================
# HAPI FHIR (Spring Boot)
# =============================================================================

SPRING_CONFIG_LOCATION=file:///data/hapi/application.yaml
SPRING_DATASOURCE_URL=jdbc:postgresql://hapi-db:5433/root
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=hapifhir2023
SPRING_DATASOURCE_DRIVERCLASSNAME=org.postgresql.Driver
SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT=ca.uhn.fhir.jpa.model.dialect.HapiFhirPostgres94Dialect

# =============================================================================
# POSTGRESQL
# =============================================================================

POSTGRES_DB=root
POSTGRES_USER=root
POSTGRES_PASSWORD=hapifhir2023

#-------------------------------------------------------------------------------

#documentacion del deploy en dokploy Generada por cloude
# Instrucciones operativas — IPS Nodo Dominio en Dokploy

## Dominios y acceso

- Panel Dokploy: https://admindokployservoracle.fgnu.ar
- Nodo FHIR: https://ipsgarrahan.fgnu.ar
- IP del servidor: 51.170.59.68
- Repositorio: https://github.com/fernandonu/ips-nodo-dominio (branch `master`)
- Proyecto en Dokploy: `ips-nodo-dominio-nodo-1uevat`

## Cambiar una variable de entorno

El flujo correcto y soportado es siempre desde la UI de Dokploy:

1. Dokploy → Proyecto → pestaña **Environment** → editar el valor → **Save**
2. Pestaña **Deployments** → botón **Deploy** (no usar el ícono ↺, no dispara un redeploy real)
3. Verificar que el contenedor tomó el valor nuevo:
   ```bash
   sudo docker exec bus-gateway env | grep -E "BUS_JWT_SECRET|BUS_ISSUER"
   ```

Importante: cada Deploy completo desde Dokploy sobreescribe el archivo `.env` en
`/etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/.env` con los valores que están
en la pestaña Environment de la UI. La pestaña Environment de Dokploy es la fuente
de verdad — no editar el `.env` del servidor a mano salvo como plan de contingencia.

### Plan B — si el Deploy desde la UI no aplica los cambios

```bash
# 1. Editar el .env manualmente
sudo nano /etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/.env

# 2. Recrear el servicio afectado (ejemplo: bus-gateway)
sudo docker compose \
  --env-file /etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/.env \
  -p ips-nodo-dominio-nodo-1uevat \
  -f /etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/code/docker-compose.yml \
  up -d --force-recreate --no-deps bus-gateway

# 3. Verificar
sudo docker exec bus-gateway env | grep -E "BUS_JWT_SECRET|BUS_ISSUER"
```

O usar el script ya creado en el servidor:
```bash
sudo update-bus-env.sh
```

## Verificar estado del nodo

```bash
# Página raíz (debe responder, antes daba 404)
curl -I https://ipsgarrahan.fgnu.ar/

# Metadata FHIR
curl -I https://ipsgarrahan.fgnu.ar/fhir/metadata

# Consulta paciente al Bus (debe ir al bus-gateway, no a hapi-fhir directo)
curl -s "https://ipsgarrahan.fgnu.ar/fhir/Patient?identifier=http%3A%2F%2Fwww.renaper.gob.ar%2Fdni%7C30945027"
```

Una respuesta JSON con datos de paciente confirma que tanto el ruteo de Traefik
como la autenticación contra el Bus nacional (`BUS_ISSUER` / `BUS_JWT_SECRET`)
están funcionando correctamente.

## Ver logs en tiempo real

```bash
sudo docker logs -f bus-gateway
sudo docker logs -f hapi-fhir
sudo docker logs -f hapi-db
sudo docker logs -f dokploy-traefik
```

## Reiniciar servicios

```bash
sudo docker restart bus-gateway
sudo docker restart hapi-fhir
```

Nota: un `docker restart` simple NO actualiza variables de entorno — solo reinicia
el proceso con las variables que el contenedor ya tiene. Para variables nuevas, usar
el flujo de Deploy desde la UI o el Plan B de arriba.

## Rutas de Traefik y prioridades

Traefik reemplaza al nginx que usaba el nodo originalmente. Las reglas se definen
como labels en el `docker-compose.yml`, y la prioridad determina qué router gana
cuando una request matchea más de una regla (mayor número = mayor prioridad).

| Router         | Prioridad | Rule                                                                                          | Destino      |
|----------------|-----------|------------------------------------------------------------------------------------------------|--------------|
| bus-gateway    | 200       | Host + PathPrefix(/fhir/IPSTransaction, /fhir/IPSDocument, /fhir/DocumentReference, /fhir/Patient) | bus-gateway  |
| hapi-fhir      | 100       | Host + PathPrefix(/fhir)                                                                        | hapi-fhir    |
| hapi-fhir-root | 1         | Host (catch-all, sin path)                                                                      | hapi-fhir    |

Por qué estos números específicos: Traefik con Docker provider, cuando detecta dos
o más services en un mismo contenedor, requiere que cada router tenga
`traefik.http.routers.<router>.service=<service>` explícito — sin esto Traefik no
puede asociar automáticamente router con service y los descarta con el error
"cannot be linked automatically with multiple Services".

Además, si no se asigna prioridad explícita Traefik calcula una automática basada
en la longitud/complejidad de la regla, lo cual hizo que en un momento el router
catch-all (`hapi-fhir-root`, regla simple `Host(...)`) terminara con MÁS prioridad
que `bus-gateway` (regla compuesta, más larga). Esto rompía el ruteo: las consultas
a `/fhir/Patient` iban a hapi-fhir en vez de al bus-gateway. La solución fue fijar
prioridades explícitas para garantizar el orden correcto:
más específico (bus-gateway) → genérico (/fhir) → catch-all (/).

No bajar estos números ni quitar el `.service=` explícito sin entender este
historial, o el ruteo puede romperse de la misma forma.

## Labels completas de referencia (docker-compose.yml)

```yaml
  hapi-fhir:
    labels:
      - traefik.enable=true
      - traefik.http.routers.hapi-fhir.rule=Host(`ipsgarrahan.fgnu.ar`) && PathPrefix(`/fhir`)
      - traefik.http.routers.hapi-fhir.entrypoints=websecure
      - traefik.http.routers.hapi-fhir.priority=100
      - traefik.http.routers.hapi-fhir.service=hapi-fhir
      - traefik.http.services.hapi-fhir.loadbalancer.server.port=8080
      - traefik.docker.network=dokploy-network
      - traefik.http.routers.hapi-fhir-root.rule=Host(`ipsgarrahan.fgnu.ar`)
      - traefik.http.routers.hapi-fhir-root.entrypoints=websecure
      - traefik.http.routers.hapi-fhir-root.priority=1
      - traefik.http.routers.hapi-fhir-root.service=hapi-fhir-root
      - traefik.http.services.hapi-fhir-root.loadbalancer.server.port=8080

  bus-gateway:
    labels:
      - traefik.enable=true
      - traefik.http.routers.bus-gateway.rule=Host(`ipsgarrahan.fgnu.ar`) && (PathPrefix(`/fhir/IPSTransaction`) || PathPrefix(`/fhir/IPSDocument`) || PathPrefix(`/fhir/DocumentReference`) || PathPrefix(`/fhir/Patient`))
      - traefik.http.routers.bus-gateway.entrypoints=websecure
      - traefik.http.routers.bus-gateway.priority=200
      - traefik.http.services.bus-gateway.loadbalancer.server.port=3000
      - traefik.docker.network=dokploy-network
```

## DNS y certificados TLS

- DNS de ambos dominios (`admindokployservoracle.fgnu.ar` e `ipsgarrahan.fgnu.ar`)
  debe estar en modo **DNS only** en Cloudflare (nube gris, no naranja). El proxy
  de Cloudflare rompe el httpChallenge de Let's Encrypt.
- Puertos 80 y 443 deben estar abiertos tanto en iptables del servidor como en el
  Security Group de la VCN de Oracle Cloud.
- Traefik renueva los certificados automáticamente, no requiere acción manual.

```bash
# Verificar DNS
dig ipsgarrahan.fgnu.ar +short
dig admindokployservoracle.fgnu.ar +short
# Ambos deben devolver: 51.170.59.68

# Verificar puertos abiertos
sudo iptables -L INPUT -n | grep -E '80|443'
```

## Archivos clave en el servidor

```
/etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/.env
/etc/dokploy/compose/ips-nodo-dominio-nodo-1uevat/code/docker-compose.yml
/etc/dokploy/traefik/traefik.yml
/etc/dokploy/traefik/dynamic/dokploy.yml
/usr/local/bin/update-bus-env.sh
```

## Configuración de Traefik para el panel de Dokploy

El panel de administración (`admindokployservoracle.fgnu.ar`) se expone mediante
una configuración manual en `/etc/dokploy/traefik/dynamic/dokploy.yml`:

```yaml
http:
  routers:
    dokploy-router-app:
      rule: Host(`dokploy.docker.localhost`) && PathPrefix(`/`)
      service: dokploy-service-app
      entryPoints:
        - web
    dokploy-admin:
      rule: "Host(`admindokployservoracle.fgnu.ar`)"
      service: dokploy-admin-service
      entryPoints:
        - websecure

  services:
    dokploy-service-app:
      loadBalancer:
        servers:
          - url: http://dokploy:3000
        passHostHeader: true
    dokploy-admin-service:
      loadBalancer:
        servers:
          - url: "http://dokploy:3000"
        passHostHeader: true
```

El TLS para este dominio se aplica automáticamente porque el entrypoint
`websecure` en `traefik.yml` ya tiene `certResolver: letsencrypt` configurado
de forma global.

El servicio Dokploy en sí corre como un servicio de Docker Swarm (no un
contenedor suelto). Para agregar variables de entorno (como se hizo con
`NEXTAUTH_URL` para corregir el logout):

```bash
sudo docker service update \
  --env-add NEXTAUTH_URL=https://admindokployservoracle.fgnu.ar \
  dokploy
```

## Historial de incidentes resueltos

| Fecha | Problema | Causa | Solución |
|---|---|---|---|
| Migración inicial | YAML inválido en config Traefik | Dos bloques `http:` separados en el mismo archivo | Fusionar en un solo bloque `http:` |
| Migración inicial | Dominio admin no resolvía HTTPS | Email `test@localhost.com` inválido para Let's Encrypt | Cambiar a email real, borrar y regenerar `acme.json` |
| Migración inicial | DNS no resolvía a la IP del servidor | Proxy de Cloudflare activado (nube naranja) | Cambiar a DNS only (nube gris) |
| Migración inicial | Puertos 80/443 inalcanzables | iptables sin reglas ACCEPT para esos puertos | Abrir puertos con iptables + Security Group OCI |
| Login Dokploy | 403 Forbidden al loguear | Faltaba `passHostHeader: true` en el service del admin | Agregar `passHostHeader: true` |
| Cambio de variables | Variables no se actualizaban con `docker restart` | Dokploy no escribe `.env` hasta un Deploy completo desde la UI | Usar Deploy desde Deployments, no restart ni el ícono ↺ |
| Logout Dokploy | Redirigía mal al desloguear | Faltaba `NEXTAUTH_URL` en el servicio Swarm | `docker service update --env-add NEXTAUTH_URL=...` |
| Página raíz | 404 en `https://ipsgarrahan.fgnu.ar/` | nginx mandaba `/` a hapi-fhir, Traefik no tenía esa ruta | Agregar router `hapi-fhir-root` catch-all |
| Routers múltiples | Traefik no podía linkear el router con el service | Un contenedor con 2+ services requiere `.service=` explícito | Agregar `traefik.http.routers.<x>.service=<service>` |
| Ruteo del Bus | `/fhir/Patient` iba a hapi-fhir en vez de bus-gateway | Prioridad automática del catch-all (27) > prioridad de bus-gateway (10) | Fijar prioridades explícitas: bus-gateway=200, hapi-fhir=100, root=1 |

---
Documento actualizado — Junio 2026

