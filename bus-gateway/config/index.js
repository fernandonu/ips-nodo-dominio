require('dotenv').config();

const config = {
    bus: {
        url: process.env.BUS_URL,
        mpiUrl: process.env.MPI_URL || process.env.BUS_URL,
        documentRegistryUrl: process.env.DOCUMENT_REGISTRY_URL || process.env.BUS_URL,
        jwtSecret: process.env.BUS_JWT_SECRET,
        issuer: process.env.BUS_ISSUER,
        mpiScope: process.env.MPI_SCOPE,
        documentRegistryScope: process.env.DOCUMENT_REGISTRY_SCOPE,
    },
    fhir: {
        url: process.env.FHIR_URL,
    },
    logging: {
        enabled: true,
        level: 'debug',
        depthLimit: 5,
        edgeLimit: 100,
        msgPrefix: undefined,
        crlf: false,
        messageKey: 'msg',
        errorKey: 'err',
        nestedKey: null,
    },
    baseURL: process.env.NODO_URL_BASE || 'http://localhost',
    debug: process.env.BUS_DEBUG === 'true',
};

const required = [
    ['BUS_URL', config.bus.url],
    ['BUS_JWT_SECRET', config.bus.jwtSecret],
    ['BUS_ISSUER', config.bus.issuer],
    ['MPI_SCOPE', config.bus.mpiScope],
    ['DOCUMENT_REGISTRY_SCOPE', config.bus.documentRegistryScope],
    ['FHIR_URL', config.fhir.url],
];

const missing = required.filter(([, val]) => !val).map(([key]) => key);
if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

module.exports = config;
