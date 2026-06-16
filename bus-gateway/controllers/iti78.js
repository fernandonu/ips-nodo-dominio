const config = require('../config');
const { getBusToken, createBusRequest } = require('../utils/busAuth');
const { findPatient, findPatientById } = require('../services/patient');

/**
 * ITI-78: Mobile Patient Demographics Query (PDQm)
 *
 * GET /fhir/Patient
 * Forwards the raw FHIR query parameters to the Bus and returns the Bundle result.
 */
async function listPatient(req, res, next) {
    try {
        const token = await getBusToken(config.bus.url, config.bus.jwtSecret, config.bus.issuer, config.bus.mpiScope);
        const searchset = await findPatient(token, req.query);
        res.status(200).json(searchset);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /fhir/Patient/:id
 * Forwards the request to the Bus and returns the Patient resource.
 */
async function getPatientById(req, res, next) {
    try {
        const { id } = req.params;
        const token = await getBusToken(config.bus.url, config.bus.jwtSecret, config.bus.issuer, config.bus.mpiScope);
        const patient = await findPatientById(token, id)
        res.status(200).json(patient);
    } catch (err) {
        next(err);
    }
}

module.exports = { listPatient, getPatientById };
