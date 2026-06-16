const config = require('../config');
const { createPatient: busCreatePatient, updatePatient: busUpdatePatient, findPatientById, findPatientByUrl } = require('../services/patient');
const { getBusToken } = require('../utils/busAuth');

/**
 * ITI-104: Patient Identity Feed FHIR (PMIR)
 *
 * POST /fhir/Patient
 * Forwards the Patient resource to the Bus and returns the result.
 */
async function createPatient(req, res, next) {
    try {
        const token = await getBusToken(config.bus.url, config.bus.jwtSecret, config.bus.issuer, config.bus.mpiScope);
        const patient = await busCreatePatient(token, req.body)
        res.status(200).json(patient);
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /fhir/Patient/:id
 * Forwards the update to the Bus and returns the result.
 */
async function updatePatient(req, res, next) {
    try {
        const token = await getBusToken(config.bus.url, config.bus.jwtSecret, config.bus.issuer, config.bus.mpiScope);
        const patient = await busUpdatePatient(token, req.body)
        res.status(200).json(patient);
    } catch (err) {
        next(err);
    }
}

module.exports = { createPatient, updatePatient };
