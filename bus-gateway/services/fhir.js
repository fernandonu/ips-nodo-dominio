const config = require("../config");
const axios = require('axios');


const HAPI_FHIR_SERVER_URL = config.fhir.url;


/**
 * Procesa una transacción y devuelve los recursos persistidos en el servidor HAPI FHIR
 * @param {*} transactionBundle 
 * @returns 
 */
async function processDocumentBundleTransaction(transactionBundle) {
    const response = await axios.post(HAPI_FHIR_SERVER_URL, transactionBundle, {
        headers: { 'Content-Type': 'application/fhir+json' },
    });
    return response.data;
}


async function getResourceByUrl(url) {
    const response = await axios.get(
        URL.parse(url, HAPI_FHIR_SERVER_URL)
    );
    return response.data;
}


async function getDocumentBundleByUrl(url) {
    const response = await axios.get(parsedUrl.toString(), {
        responseType: 'arraybuffer',
        headers: {
            Accept: req.headers['accept'] || '*/*',
        },
    });
    return response.data
}


module.exports = {
    processDocumentBundleTransaction,
    getResourceByUrl
}