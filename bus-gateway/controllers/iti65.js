const axios = require('axios');
const createError = require('http-errors');
const config = require('../config');
const { getBusToken, createBusRequest } = require('../utils/busAuth');
const { findPatient } = require('../services/patient');
const { createDocumentReference, findDocumentReferenceById } = require('../services/documentReference');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { getResourceByUrl, processDocumentBundleTransaction } = require('../services/fhir');


const DOCUMENT_REFERENCE_RESOURCE_TYPE = "DocumentReference";
const IPS_DOCUMENT_RESOURCE_TYPE = 'Bundle';
const PATIENT_RESOURCE_TYPE = 'Patient';
const LIST_RESOURCE_TYPE = 'List';


const NATIONAL_ID_SYSTEM = 'https://federador.msal.gob.ar/patient-id';
const DNI_SYSTEM = 'http://www.renaper.gob.ar/dni';
const CUSTODIAN_ID_SYSTEM = 'http://federador.msal.gob.ar/uri';
const MASTER_ID_SYSTEM = 'urn:ietf:rfc:3986'


function extractResource(resources, resourceType) {
    return resources.filter(r => r.resourceType === resourceType)[0];
}

function extractLocalIdentifier(patient) {
    return patient.identifier.filter(i => {
        return i.system !== NATIONAL_ID_SYSTEM && ((!!i.use && i.use === 'official') || (!i.use))
    })[0];
}

function generateDocumentReferenceResource(subjectReference, bundleUrl) {
    const documentRefernece = {
        resourceType: 'DocumentReference',
        status: 'current',
        masterIdentifier: {
            use: 'usual',
            system: MASTER_ID_SYSTEM,
            value: `urn:uuid:${uuidv4()}`
        },
        type: {
            coding: [
                {
                    system: 'http://loinc.org',
                    code: '60591-5',
                    display: 'Patient Summary Document',
                },
            ],
        },
        date: new Date().toISOString(),
        subject: {
            reference: subjectReference
        },
        custodian: {
            identifier: { system: CUSTODIAN_ID_SYSTEM, value: config.bus.issuer },
        },
        content: [
            {
                attachment: {
                    url: bundleUrl,
                    contentType: 'application/fhir+json'
                },
            },
        ],
    };
    return documentRefernece;
}

async function getResourcesFromTransactionResponse(transactionResponse) {
    const promises = transactionResponse.entry.map(async (e) => {
        const resource = await getResourceByUrl(`${config.fhir.url}/${e.response.location}`);
        return resource;
    });
    return Promise.all(promises);
}

/**
 * Construye un Bundle de tipo transaction a partir de un Bundle de tipo document (IPS).
 * Genera Patient, Bundle (IPS), DocumentReference y List (SubmissionSet MHD).
 * Usa urn:uuid: como fullUrl para que HAPI FHIR resuelva las referencias internas.
 */
function buildTransactionFromIPSDocument(ipsBundle) {
    if (ipsBundle.type !== 'document') {
        throw createError(400, 'Bundle must be of type document');
    }
    const patientEntry = (ipsBundle.entry || []).find(
        e => e.resource && e.resource.resourceType === 'Patient'
    );
    if (!patientEntry) {
        throw createError(400, 'IPS Bundle must contain a Patient resource');
    }

    const patientFullUrl = `urn:uuid:${uuidv4()}`;
    const bundleFullUrl = `urn:uuid:${uuidv4()}`;
    const documentReferenceFullUrl = `urn:uuid:${uuidv4()}`;

    const now = new Date().toISOString();

    const localDocumentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        masterIdentifier: {
            use: 'usual',
            system: MASTER_ID_SYSTEM,
            value: `urn:uuid:${uuidv4()}`
        },
        type: {
            coding: [{
                system: 'http://loinc.org',
                code: '60591-5',
                display: 'Patient Summary Document',
            }]
        },
        date: now,
        subject: { reference: patientFullUrl },
        custodian: {
            identifier: { system: CUSTODIAN_ID_SYSTEM, value: config.bus.issuer }
        },
        content: [{
            attachment: {
                url: bundleFullUrl,
                contentType: 'application/fhir+json'
            }
        }]
    };

    const submissionSetList = {
        resourceType: 'List',
        status: 'current',
        mode: 'working',
        code: {
            coding: [{
                system: 'https://profiles.ihe.net/ITI/MHD/CodeSystem/MHDlistTypes',
                code: 'submissionset'
            }]
        },
        date: now,
        subject: { reference: patientFullUrl },
        source: {
            identifier: { system: CUSTODIAN_ID_SYSTEM, value: config.bus.issuer }
        },
        entry: [
            { item: { reference: documentReferenceFullUrl } },
            { item: { reference: bundleFullUrl } }
        ]
    };

    return {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
            {
                fullUrl: patientFullUrl,
                resource: patientEntry.resource,
                request: { method: 'POST', url: 'Patient' }
            },
            {
                fullUrl: bundleFullUrl,
                resource: ipsBundle,
                request: { method: 'POST', url: 'Bundle' }
            },
            {
                fullUrl: documentReferenceFullUrl,
                resource: localDocumentReference,
                request: { method: 'POST', url: 'DocumentReference' }
            },
            {
                resource: submissionSetList,
                request: { method: 'POST', url: 'List' }
            }
        ]
    };
}

/**
 * Lógica central de ITI-65: persiste la transacción en HAPI FHIR, resuelve el
 * paciente en el Bus y registra un DocumentReference apuntando al Bundle guardado.
 */
async function executeITI65(transaction, token) {
    const transactionResponse = await processDocumentBundleTransaction(transaction);
    const resources = await getResourcesFromTransactionResponse(transactionResponse);

    const localPatient = extractResource(resources, PATIENT_RESOURCE_TYPE);
    const localIPSDocument = extractResource(resources, IPS_DOCUMENT_RESOURCE_TYPE);
    const localPatientIdentifier = extractLocalIdentifier(localPatient);

    const patientSearchset = await findPatient(token, { identifier: `${localPatientIdentifier.system}|${localPatientIdentifier.value}` });
    if (patientSearchset.total == 0) {
        throw createError(404, 'Patient does not exists');
    }
    const nationalPatientId = patientSearchset.entry[0].fullUrl;
    const bundleReference = `${config.baseURL}/fhir/Bundle/${localIPSDocument.id}`;

    const documentReference = generateDocumentReferenceResource(nationalPatientId, bundleReference);
    return createDocumentReference(token, documentReference);
}

/**
 * ITI-65: Provide Document Bundle (MHD) — variante transacción
 *
 * POST /fhir/iti65
 *
 * Espera un Bundle de tipo transaction construido por el cliente.
 */
async function provideIPSTransaction(req, res, next) {
    try {
        const transaction = req.body;
        const token = await getBusToken(
            config.bus.url,
            config.bus.jwtSecret,
            config.bus.issuer,
            [config.bus.mpiScope, config.bus.documentRegistryScope].join(',')
        );
        const result = await executeITI65(transaction, token);
        return res.status(200).json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * ITI-65: Provide Document Bundle (MHD) — variante IPS document
 *
 * POST /fhir/Bundle
 *
 * Espera un Bundle de tipo document (IPS). Genera internamente el Bundle
 * transaction y ejecuta el mismo flujo que provideDocumentBundle.
 */
async function provideIPSDocumentBundle(req, res, next) {
    try {
        const ipsBundle = req.body;
        if (!ipsBundle || ipsBundle.resourceType !== 'Bundle') {
            throw createError(400, 'Request body must be a FHIR Bundle resource');
        }
        const transaction = buildTransactionFromIPSDocument(ipsBundle);
        const token = await getBusToken(
            config.bus.url,
            config.bus.jwtSecret,
            config.bus.issuer,
            [config.bus.mpiScope, config.bus.documentRegistryScope].join(',')
        );
        const result = await executeITI65(transaction, token);
        return res.status(200).json(result);
    } catch (err) {
        next(err);
    }
}

module.exports = { provideIPSTransaction, provideIPSDocumentBundle };
