const config = require('../config');
const { createBusRequest } = require('../utils/busAuth');
const { default: axios } = require('axios');


const INDICE_ATENCION_URL = config.bus.documentRegistryUrl;

const LOCAL_URL = "https://federador.qa-bus-interoperabilidad.svc.cluster.local:8080/fhir/DocumentReference";

function maskPrivateURL(patientId) {
    return patientId.replace(LOCAL_URL, INDICE_ATENCION_URL);
}



async function findDocumentReferenceById(token, id) {
    const request = createBusRequest(token);
    const response = await request.get(
        URL.parse(`${INDICE_ATENCION_URL}/${id}`)
    );
    return response.data;
}


async function findDocumentReferenceByUrl(token, id) {
    const request = createBusRequest(token);
    const response = await request.get(
        URL.parse(id, INDICE_ATENCION_URL)
    );
    return response.data;
}

/**
 * Posts a DocumentReference to the document registry
 * (POST /fhir/DocumentReference).
 * @param {string} documentRegistryUrl - Base URL of the document registry service.
 * @param {string} token - Bearer access token.
 * @param {object} documentReference - FHIR DocumentReference resource to register.
 * @returns {Promise<object>} The created DocumentReference resource returned by the registry.
 * @todo Agregar system http://federador.msal.gob.ar/uri para armar el identificador del custodian: http://federador.msal.gob.ar/uri|<custodianId>
 */
async function createDocumentReference(token, documentReference) {
    const request = createBusRequest(token);
    const response = await request.post(
        URL.parse(INDICE_ATENCION_URL),
        documentReference
    );
    const location = maskPrivateURL(response.headers['location']);
    return findDocumentReferenceByUrl(token, location);
}
/**
 * Searches DocumentReferences in the document registry by patient subject identifier
 * (GET /fhir/DocumentReference?subject=system|value).
 * @param {string} documentRegistryUrl - Base URL of the document registry service.
 * @param {string} token - Bearer access token.
 * @param {string} subjectSystem - Identifier system of the patient.
 * @param {string} subjectValue - Identifier value of the patient.
 * @returns {Promise<object>} FHIR Bundle (searchset) with matching DocumentReferences.
 */
async function findDocumentReferenceBySubject(token, subjectSystem, subjectValue) {
    const request = createBusRequest(token);
    const response = await request.get(
        URL.parse(INDICE_ATENCION_URL),
        {
            params: { subject: `${subjectSystem}|${subjectValue}` },
        }
    );
    return response.data;
}

/**
 * Searches DocumentReferences in the document registry by patient internal ID
 * (GET /fhir/DocumentReference?patient=value).
 * @param {string} documentRegistryUrl - Base URL of the document registry service.
 * @param {string} token - Bearer access token.
 * @param {string} patientId - Internal patient ID in the document registry.
 * @returns {Promise<object>} FHIR Bundle (searchset) with matching DocumentReferences.
 */
async function findDocumentReferenceByPatient(token, patientId) {
    const request = createBusRequest(token);
    const response = await request.get(
        URL.parse(INDICE_ATENCION_URL),
        {
            params: { subject: patientId },
        }
    );
    return response.data;
}

/**
 * Searches DocumentReferences in the document registry filtered by subject, custodian and type
 * (GET /fhir/DocumentReference?subject=...&custodian=...&type=...).
 * @param {string} documentRegistryUrl - Base URL of the document registry service.
 * @param {string} token - Bearer access token.
 * @param {{ system: string, value: string }} subject   - Patient identifier (TokenParam).
 * @param {{ system: string, value: string }} custodian - Custodian identifier (TokenParam).
 * @param {{ system: string, value: string }} type      - Document type (TokenParam, e.g. { system: 'http://loinc.org', value: '60591-5' }).
 * @returns {Promise<object>} FHIR Bundle (searchset) with matching DocumentReferences.
 */
async function searchDocumentReference(token, subject, custodian, type) {
    const request = createBusRequest(token);
    const response = await request.get(
        URL.parse(INDICE_ATENCION_URL),
        {
            params: {
                subject: `${subject.system}|${subject.value}`,
                custodian: `${custodian.system}|${custodian.value}`,
                type: `${type.system}|${type.value}`,
            },
        });
    return response.data;
}

module.exports = {
    findDocumentReferenceById,
    createDocumentReference,
    findDocumentReferenceBySubject,
    findDocumentReferenceByPatient,
    searchDocumentReference
};
