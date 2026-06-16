# bus-gateway

Gateway de interoperabilidad FHIR que expone los perfiles IHE MHD y PDQm/PMIR como fachada hacia un Bus de Interoperabilidad (Federador MSAL) y un servidor HAPI FHIR local.

## Descripción

El componente actúa exclusivamente como gateway: no contiene lógica de negocio propia. Su responsabilidad es:

- Obtener el token de autenticación del Bus.
- Redirigir las llamadas entrantes al servicio de backend correspondiente (MPI, Document Registry o HAPI FHIR).
- Devolver los resultados al cliente tal como los retornan los servicios subyacentes.

## Transacciones IHE implementadas

| Transacción | Método | Ruta | Descripción |
|---|---|---|---|
| ITI-65 | `POST` | `/fhir/Bundle` | Provide Document Bundle: almacena el Bundle en HAPI FHIR, resuelve el ID nacional del paciente vía `$match` en el Bus y registra el DocumentReference en el Document Registry. |
| ITI-67 | `GET` | `/fhir/DocumentReference` | Find Document References: busca el paciente por ID local en el MPI para obtener su ID nacional y consulta los DocumentReferences en el Document Registry. |
| ITI-78 | `GET` | `/fhir/Patient` | Patient Demographics Query: búsqueda de pacientes en el MPI. |
| ITI-78 | `GET` | `/fhir/Patient/:id` | Patient Demographics Query: obtención de un paciente por ID en el MPI. |
| ITI-104 | `POST` | `/fhir/Patient` | Patient Identity Feed: alta de paciente en el MPI. |
| ITI-104 | `PUT` | `/fhir/Patient/:id` | Patient Identity Feed: actualización de paciente en el MPI. |

## Variables de entorno

Copiá `.env.example` a `.env` y completá los valores:

```bash
cp .env.example .env
```

| Variable | Requerida | Descripción |
|---|---|---|
| `BUS_URL` | Sí | URL base del Bus. Se usa para autenticación y como fallback si no se definen `MPI_URL` ni `DOCUMENT_REGISTRY_URL`. |
| `BUS_JWT_SECRET` | Sí | Secreto compartido para firmar el JWT de autenticación contra el Bus. |
| `BUS_ISSUER` | Sí | Issuer del JWT (URL del repositorio). |
| `MPI_SCOPE` | Sí | Scopes OAuth para el MPI (ej: `Patient/*.read,Patient/*.write`). |
| `DOCUMENT_REGISTRY_SCOPE` | Sí | Scopes OAuth para el Document Registry (ej: `DocumentReference/*.read,DocumentReference/*.write`). |
| `MPI_URL` | No | URL base del servicio MPI (Master Patient Index). Si no se define, usa `BUS_URL`. |
| `DOCUMENT_REGISTRY_URL` | No | URL base del Document Registry. Si no se define, usa `BUS_URL`. |
| `FHIR_URL` | Sí | URL base del servidor HAPI FHIR local. |
| `PORT` | No | Puerto en que escucha el servidor. Por defecto `3000`. |

### Usar la misma URL para todos los servicios del Bus

Si el MPI y el Document Registry están expuestos bajo la misma URL que el Bus, alcanza con omitir `MPI_URL` y `DOCUMENT_REGISTRY_URL`:

```env
BUS_URL=http://bus-host:8080
BUS_JWT_SECRET=your-shared-secret
BUS_ISSUER=https://your-repositorio-url
MPI_SCOPE=Patient/*.read,Patient/*.write
DOCUMENT_REGISTRY_SCOPE=DocumentReference/*.read,DocumentReference/*.write

FHIR_URL=http://hapi-fhir-host:8080/fhir
```

`MPI_URL` y `DOCUMENT_REGISTRY_URL` toman el valor de `BUS_URL` automáticamente.

### Usar URLs diferentes por servicio

Si cada servicio está en un host o contexto distinto:

```env
BUS_URL=http://bus-host:8080
BUS_JWT_SECRET=your-shared-secret
BUS_ISSUER=https://your-repositorio-url
MPI_SCOPE=Patient/*.read,Patient/*.write
DOCUMENT_REGISTRY_SCOPE=DocumentReference/*.read,DocumentReference/*.write

MPI_URL=http://mpi-host:8080
DOCUMENT_REGISTRY_URL=http://document-registry-host:8080

FHIR_URL=http://hapi-fhir-host:8080/fhir
```

## Ejecución local (sin Docker)

### Requisitos

- Node.js 20+
- Acceso al Bus de Interoperabilidad y al servidor HAPI FHIR

### Instalación

```bash
npm install
```

### Inicio

```bash
cp .env.example .env   # completar las variables
npm start
```

El servidor queda disponible en `http://localhost:3000`.

Para usar un puerto diferente:

```bash
PORT=8080 npm start
```

### Tests

```bash
npm test
```

Para correr un archivo específico:

```bash
npm test tests/utils/busAuth.test.js
npm test tests/services/patient.test.js
npm test tests/services/documentReference.test.js
```

## Ejecución con Docker

```bash
cp .env.example .env   # configurar variables
docker compose up -d
```

Para ver los logs:

```bash
docker compose logs -f
```

## Headers requeridos por transacción

### ITI-65 `POST /fhir/Bundle`

| Header | Descripción |
|---|---|
| `x-custodian-id` | Identificador del efector en el sistema Federador MSAL. |
| `Content-Type` | `application/fhir+json` |

## Estructura del proyecto

```
bin/          Entrypoint del servidor Express
config/       Carga y validación de variables de entorno
controllers/  Lógica de cada transacción IHE
routes/       Definición de rutas HTTP por transacción
services/     Clientes de los servicios externos (MPI, Document Registry)
utils/        Autenticación contra el Bus (JWT + token)
```
