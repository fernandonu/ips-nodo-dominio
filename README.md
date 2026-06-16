# IPS Nodo Dominio

Plataforma de interoperabilidad en salud basada en Docker Compose que implementa el **Nodo de Dominio IPS** (International Patient Summary). Actúa como gateway de integración entre servicios FHIR locales y el Bus nacional de salud (Federador MSAL).

## Arquitectura

```
Internet / Red interna
        │
    nginx:80/443
        │
   ┌────┴─────────────────────────────────────────┐
   │  /fhir/IPSTransaction   →  bus-gateway:3000  │
   │  /fhir/IPSDocument      →  bus-gateway:3000  │
   │  /fhir/DocumentReference→  bus-gateway:3000  │
   │  /fhir/Patient          →  bus-gateway:3000  │
   │  /fhir/* (resto)        →  hapi-fhir:8080    │
   └──────────────────────────────────────────────┘
```

## Servicios

| Servicio | Imagen / Fuente | Puerto | Descripción |
|---|---|---|---|
| `hapi-fhir` | `hapiproject/hapi:latest` | 8080 (interno) | Servidor FHIR R4 (Spring Boot) con búsqueda Lucene |
| `hapi-db` | `postgres:14.6` | 5433 (interno) | Base de datos PostgreSQL para HAPI FHIR |
| `bus-gateway` | `./bus-gateway` (Node.js) | 3000 (interno) | Gateway al Bus de salud nacional (MPI + Document Registry) |
| `nginx` | `nginx:alpine` | 80 / 443 | Proxy inverso — punto de entrada HTTP/HTTPS |

**Red interna**: todos los servicios se comunican a través de la red Docker `hapi-network`.

**Volúmenes persistentes**: `hapi-data` (PostgreSQL de HAPI).

## Transacciones IHE implementadas

El `bus-gateway` implementa los siguientes perfiles de interoperabilidad:

| Transacción | Método | Ruta | Descripción |
|---|---|---|---|
| **ITI-65** | POST | `/fhir/IPSTransaction` | Provide Document Bundle (transacción) |
| **ITI-65** | POST | `/fhir/IPSDocument` | Provide Document Bundle (documento IPS) |
| **ITI-67** | GET | `/fhir/DocumentReference` | Find Document References |
| **ITI-78** | GET | `/fhir/Patient` | Patient Demographics Query (búsqueda) |
| **ITI-78** | GET | `/fhir/Patient/:id` | Patient Demographics Query (por ID) |
| **ITI-104** | POST | `/fhir/Patient` | Patient Identity Feed (alta) |
| **ITI-104** | PUT | `/fhir/Patient/:id` | Patient Identity Feed (actualización) |

## Requisitos

### Software

- Docker >= 20.10.8
- Docker Compose >= 1.29.2

### Hardware del servidor

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 núcleos | 4 núcleos |
| Memoria RAM | 4 GB | 8 GB |
| Disco | 10 GB | 30 GB |

> El mayor consumo de recursos corresponde a **HAPI FHIR** (JVM + índice Lucene), que requiere al menos 2 GB de RAM para arrancar correctamente. El volumen de disco recomendado contempla el crecimiento de los datos clínicos almacenados en PostgreSQL.

## Instalación y configuración

### 1. Variables de entorno

```bash
cp .env.example .env
```

Editar `.env` completando al menos las variables marcadas como requeridas. Ver la sección [Variables de entorno](#variables-de-entorno) para la descripción completa.

### 2. Certificados

Los certificados se inyectan como **Docker secrets**. Las rutas se configuran en el `.env` (todas tienen valores por defecto apuntando a `./certs/`):

| Archivo por defecto | Descripción |
|---|---|
| `./certs/server.crt` / `./certs/server.key` | Certificado TLS para nginx (solo modo HTTPS) |

> **Importante:** Los archivos `ssl_cert` y `ssl_key` deben existir en el sistema de archivos para que Docker pueda montarlos como secrets, incluso si se usa el modo HTTP. Si no se cuenta con certificados reales, crear archivos vacíos:
>
> ```bash
> touch ./certs/server.crt
> touch ./certs/server.key
> ```

> Ver [certs/README.md](certs/README.md) para instrucciones de generación de certificados de prueba.

### 3. Configuración de nginx (HTTP o HTTPS)

La variable `NGINX_CONF` en el `.env` selecciona el modo:

**HTTP** (por defecto):
```env
NGINX_CONF=http
```

**HTTPS** (requiere certificados válidos en `./certs/`):
```env
NGINX_CONF=https
SSL_CERT_PATH=./certs/server.crt
SSL_KEY_PATH=./certs/server.key
```

En modo HTTPS el tráfico HTTP (puerto 80) se redirige automáticamente a HTTPS (443). Los certificados los lee nginx desde `/run/secrets/ssl_cert` y `/run/secrets/ssl_key`.

Los archivos de configuración están en [nginx/http.conf](nginx/http.conf) y [nginx/https.conf](nginx/https.conf).

### 4. Configuración HAPI FHIR

Los parámetros del servidor FHIR se ajustan en [hapi-config/application.yaml](hapi-config/application.yaml). El servidor usa **Lucene** como backend de búsqueda (índice local, no requiere servicio externo). CORS está habilitado para todos los orígenes (`*`).

## Levantar los servicios

```bash
docker compose up -d
```

HAPI FHIR tarda aproximadamente **30–40 segundos** en inicializar. El `bus-gateway` espera a que el contenedor `hapi-fhir` esté iniciado, pero no verifica que el servidor FHIR haya completado su arranque. Antes de usar los servicios, verificar que HAPI FHIR inicializó correctamente:

```bash
docker compose logs -f hapi-fhir
```

Buscar la línea que confirma el inicio exitoso:

```
Started Application in XX seconds
```

## Verificar el despliegue

```bash
# Estado de los contenedores
docker compose ps

# CapabilityStatement FHIR a través de nginx
curl http://localhost/fhir/metadata

# Verificación de llegada al Bus mediante la consulta de un paciente.
curl --location 'http://localhost/fhir/Patient?identifier=http%3A%2F%2Fwww.renaper.gob.ar%2Fdni%7C30945027'

# Logs de un servicio específico
docker compose logs -f bus-gateway
```

## Detener los servicios

```bash
# Solo detener
docker compose down

# Detener y eliminar volúmenes (borra todos los datos)
docker compose down -v
```

## Variables de entorno

Todas las variables se definen en el archivo `.env` de la raíz del proyecto.

### Bus de salud (requeridas)

| Variable | Requerida | Descripción |
|---|---|---|
| `BUS_URL` | Sí | URL base del Bus de salud nacional |
| `BUS_JWT_SECRET` | Sí | Secreto compartido para firmar JWT (HS256) |
| `BUS_ISSUER` | Sí | Identificador del emisor JWT (ej.: URL del repositorio) |
| `MPI_SCOPE` | Sí | Scopes OAuth para el MPI (ej.: `Patient/*.read,Patient/*.write`) |
| `DOCUMENT_REGISTRY_SCOPE` | Sí | Scopes OAuth para el Document Registry |

### Bus de salud (opcionales)

| Variable | Default | Descripción |
|---|---|---|
| `MPI_URL` | `BUS_URL` | URL del Master Patient Index (si difiere del Bus principal) |
| `DOCUMENT_REGISTRY_URL` | `BUS_URL` | URL del Document Registry (si difiere del Bus principal) |
| `BUS_DEBUG` | `false` | Habilita logs detallados de requests/responses al Bus |

### Nodo

| Variable | Default | Descripción |
|---|---|---|
| `NODO_URL_BASE` | `http://localhost` | URL base del nodo (usada por bus-gateway) |
| `TZ` | `America/Argentina/Buenos_Aires` | Zona horaria para todos los servicios |

### FHIR local (gestionada internamente)

| Variable | Valor fijo | Descripción |
|---|---|---|
| `FHIR_URL` | `http://hapi-fhir:8080/fhir` | URL del servidor FHIR interno (fijada en docker-compose) |

### Nginx

| Variable | Default | Descripción |
|---|---|---|
| `NGINX_CONF` | `http` | Modo de operación: `http` o `https` |
| `SSL_CERT_PATH` | `./certs/server.crt` | Ruta al certificado TLS del servidor |
| `SSL_KEY_PATH` | `./certs/server.key` | Ruta a la clave privada TLS del servidor |

### HAPI FHIR / PostgreSQL

| Variable | Default | Descripción |
|---|---|---|
| `SPRING_CONFIG_LOCATION` | `file:///data/hapi/application.yaml` | Ruta al archivo de configuración de HAPI |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://hapi-db:5433/root` | URL JDBC de la BD (debe usar puerto `5433`) |
| `SPRING_DATASOURCE_USERNAME` | `root` | Usuario de la base de datos |
| `SPRING_DATASOURCE_PASSWORD` | `hapifhir2023` | Contraseña de la base de datos |
| `SPRING_DATASOURCE_DRIVERCLASSNAME` | `org.postgresql.Driver` | Driver JDBC |
| `SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT` | `ca.uhn.fhir.jpa.model.dialect.HapiFhirPostgres94Dialect` | Dialecto Hibernate |
| `POSTGRES_DB` | `root` | Nombre de la base de datos PostgreSQL |
| `POSTGRES_USER` | `root` | Usuario PostgreSQL |
| `POSTGRES_PASSWORD` | `hapifhir2023` | Contraseña PostgreSQL |

## Estructura del proyecto

```
ips-nodo-dominio/
├── docker-compose.yml          # Orquestación principal (4 servicios)
├── .env.example                # Plantilla de variables de entorno
├── hapi-config/
│   └── application.yaml        # Configuración de HAPI FHIR (Spring Boot)
├── nginx/
│   ├── http.conf               # Config nginx modo HTTP
│   └── https.conf              # Config nginx modo HTTPS
├── certs/                      # Certificados TLS y claves de firma
│   └── README.md               # Instrucciones para generar certificados de prueba
├── bus-gateway/                # Gateway Node.js/Express
│   ├── controllers/            # Manejadores de transacciones IHE (ITI-65/67/78/104)
│   ├── routes/                 # Definición de rutas Express
│   ├── services/               # Clientes de servicios externos (MPI, Document Registry, FHIR)
│   ├── utils/                  # Utilidades (auth, logging)
│   ├── docs/                   # Diagramas de secuencia Mermaid
│   └── tests/                  # Suite de pruebas Jest
├── json/                       # Fixtures y schemas JSON
└── tests/
    └── fixtures/               # Fixtures para pruebas de integración
```

## Desarrollo

### Ejecutar tests del bus-gateway

```bash
cd bus-gateway
npm install
npm test
```

### Debug remoto

El `bus-gateway` arranca con `--inspect=0.0.0.0:9229`, por lo que se puede conectar un debugger Node.js al puerto `9229`.

### Diagramas de secuencia

Los flujos de cada transacción están documentados como diagramas Mermaid en [bus-gateway/docs/](bus-gateway/docs/).
