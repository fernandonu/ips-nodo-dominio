const config = require('../config')
const { createBusRequest } = require('../utils/busAuth');


const MPI_URL = config.bus.mpiUrl;


const LOCAL_URL = "https://federador.qa-bus-interoperabilidad.svc.cluster.local:8080/masterfile-federacion-service/fhir/Patient"

function maskPrivateURL(patientId) {
    return patientId.replace(LOCAL_URL, MPI_URL);
}

/**
 * POSTs a Patient to the MPI (Master Patient Index).
 * @param {string} mpiUrl - Base URL of the MPI service.
 * @param {string} token - Bearer access token obtained from getBusToken.
 * @param {object} patient - The Patient resource.
 * @returns {Promise<object>} Response data from the MPI.
 */
async function createPatient(token, patient) {
    const request = createBusRequest(token);
    const response = await request.post(
        URL.parse(MPI_URL),
        patient
    );
    const location = maskPrivateURL(response.headers['location']);
    return findPatientByUrl(token, location);
}


async function updatePatient(token, patient, id) {
    const request = createBusRequest(token);
    const response = await request.put(
        URL.parse(`${MPI_URL}/${id}`),
        patient
    );
    return response.data;
}

/**
 * Searches patients on the MPI using FHIR search criteria (GET /fhir/Patient).
 * @param {string} mpiUrl - Base URL of the MPI service.
 * @param {string} token - Bearer access token.
 * @param {object} criteria - Search criteria (all optional):
 *   @param {string} [criteria.name]             - Given name
 *   @param {string} [criteria.family]           - Compound family name (fathers + mothers)
 *   @param {string} [criteria.fathersFamily]    - Fathers family name
 *   @param {string} [criteria.mothersFamily]    - Mothers family name
 *   @param {string} [criteria.identifierSystem] - Identifier system (OID)
 *   @param {string} [criteria.identifierValue]  - Identifier value
 *   @param {string} [criteria.birthdate]        - Birth date (YYYY-MM-DD)
 *   @param {string} [criteria.phone]            - Phone number
 *   @param {string} [criteria.gender]           - Gender (male | female | other | unknown)
 * @returns {Promise<object>} FHIR Bundle (searchset) with matching patients.
 */
async function findPatient(token, criteria = {}) {
    const request = createBusRequest(token);

    const params = {};
    if (criteria.name) params.name = criteria.name;
    if (criteria.family) params.family = criteria.family;
    if (criteria.fathersFamily) params.fathersFamily = criteria.fathersFamily;
    if (criteria.mothersFamily) params.mothersFamily = criteria.mothersFamily;
    if (criteria.birthdate) params.birthdate = criteria.birthdate;
    if (criteria.phone) params.phone = criteria.phone;
    if (criteria.gender) params.gender = criteria.gender;
    if (criteria.identifier) params.identifier = criteria.identifier;

    const response = await request.get(
        URL.parse(MPI_URL),
        { params }
    );
    if (!!response.data.entry) {
        response.data.entry = response.data.entry.map(e => {
            e.fullUrl = maskPrivateURL(e.fullUrl);
            return e;
        });
    }
    if (!!response.data.linke) {
        response.data.link = response.data.link.map(l => {
            l.url = maskPrivateURL(l.url);
            return l;
        });
    }
    return response.data;
}

async function findPatientByUrl(token, url) {
    const request = createBusRequest(token);
    const response = await request.get(
        URL.parse(url, MPI_URL)
    );
    return response.data;
}

/**
 * Fetches a single Patient by logical ID from the MPI (GET /fhir/Patient/:id).
 * @param {string} mpiUrl - Base URL of the MPI service.
 * @param {string} token - Bearer access token.
 * @param {string} id - Logical Patient ID.
 * @returns {Promise<object>} FHIR Patient resource.
 */
async function findPatientById(token, id) {
    const request = createBusRequest(token);
    const response = await request.get(
        URL.parse(`${MPI_URL}/${id}`)
    );
    return response.data;
}

/**
 * Matches a patient against the MPI using the FHIR $match operation (POST /fhir/Patient/$match).
 * @param {string} mpiUrl - Base URL of the MPI service.
 * @param {string} token - Bearer access token.
 * @param {object} patient - The Patient resource to match.
 * @param {number} [count] - Maximum number of results to return (must be > 0).
 * @returns {Promise<object>} FHIR Bundle (searchset) with match scores.
 */
async function findPatientByMatch(token, patient, count) {
    const request = createBusRequest(token);
    const parameters = {
        resourceType: 'Parameters',
        parameter: [
            {
                name: 'resource',
                resource: patient,
            },
        ],
    };

    if (count != null) {
        parameters.parameter.push({
            name: 'count',
            valueInteger: count,
        });
    }

    const response = await request.post(
        URL.parse('$match', MPI_URL),
        parameters
    );
    return response.data;
}

module.exports = { createPatient, findPatientById, findPatientByMatch, updatePatient, findPatient };
