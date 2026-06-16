const createError = require('http-errors');
const config = require('../config');
const { getBusToken } = require('../utils/busAuth');
const { findPatient } = require('../services/patient');
const { findDocumentReferenceByPatient } = require('../services/documentReference');

const NATIONAL_ID_SYSTEM = 'https://federador.msal.gob.ar/patient-id';

/**
 * Extracts the Federador national identifier from a Patient resource.
 */
function extractNationalIdentifier(patient) {
    const identifiers = Array.isArray(patient.identifier) ? patient.identifier : [];
    return identifiers.find(id => id.system === NATIONAL_ID_SYSTEM) || null;
}



/**
 * ITI-67: Find Document References (MHD)
 *
 * GET /fhir/DocumentReference?subject=:localId
 * GET /fhir/DocumentReference?patient.identifier=:localId
 *
 * Flow:
 *   1. Fetch the Patient from the Bus by local ID to obtain the national identifier.
 *   2. Search DocumentReferences in the Bus by that national identifier.
 *   3. Return the resulting Bundle.
 *
 * Required query parameter (one of):
 *   subject            — local Patient ID in the Bus.
 *   patient.identifier — same semantics, alternate FHIR parameter name.
 */
async function listDocumentReference(req, res, next) {
    try {
        const localPatientIdentifier = req.query.subject ?? req.query['patient.identifier'];
        if (!localPatientIdentifier) {
            throw createError(400, 'Missing required query parameter: subject or patient.identifier');
        }
        const token = await getBusToken(
            config.bus.url,
            config.bus.jwtSecret,
            config.bus.issuer,
            [
                config.bus.mpiScope,
                config.bus.documentRegistryScope
            ].join(',')
        );
        // 1. Obtengo el identificador nacional del paciente en forma de referencia 
        const patientSearchset = await findPatient(token, { identifier: localPatientIdentifier });
        if (!patientSearchset) {
            throw createError(422, 'Could not resolve national identifier for the given patient');
        }
        const patientNationalId = patientSearchset.entry[0].fullUrl
        // 2. Obtengo el listado de entradas del indice de atenciones asociadada al id de paciente.
        const documentReferenceSearchset = await findDocumentReferenceByPatient(token, patientNationalId)

        res.status(200).json(documentReferenceSearchset);
    } catch (err) {
        next(err);
    }
}

module.exports = { listDocumentReference };
