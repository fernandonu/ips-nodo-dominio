const config = require('../config')
const crypto = require('crypto');
const axios = require('axios');

function base64url(buffer) {
    return Buffer.from(buffer)
        .toString('base64')
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Generates a signed JWT (HS256) for Bus auth.
 * @param {string} jwtSecret - The shared secret to sign the token.
 * @param {string} issuer - The issuer URL (repositorioURL).
 * @returns {string} Signed JWT token.
 */
function generateBusJwt(jwtSecret, issuer) {
    const header = { typ: 'JWT', alg: 'HS256' };
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const data = {
        iss: issuer,
        iat: currentTimestamp,
        exp: currentTimestamp + 6000000,
        aud: 'aud',
        sub: 'sub',
        name: 'name',
        ident: 'ident',
        role: 'role',
    };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedData = base64url(JSON.stringify(data));
    const token = `${encodedHeader}.${encodedData}`;

    const signature = crypto
        .createHmac('sha256', jwtSecret)
        .update(token)
        .digest('base64')
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${token}.${signature}`;
}

/**
 * Authenticates against the Bus and returns the access token.
 * @param {string} busURL - Base URL of the Bus (e.g. http://bus-host).
 * @param {string} jwtSecret - The shared secret to sign the JWT.
 * @param {string} issuer - The issuer URL (repositorioURL).
 * @param {string} scope - OAuth scopes (e.g. "MedicationRequest/*.read,MedicationRequest/*.write").
 * @returns {Promise<string>} The access token returned by the Bus.
 */
async function getBusToken(busURL, jwtSecret, issuer, scope) {
    const clientAssertion = generateBusJwt(jwtSecret, issuer);

    const response = await axios.post(`${busURL}/bus-auth/v2/auth`, {
        grantType: 'client_credentials',
        scope,
        clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        clientAssertion,
    });

    return response.data.accessToken;
}

/**
 * Creates an axios instance pre-configured for the Bus FHIR API.
 * All requests will include the Authorization and Content-Type headers.
 * @param {string} busURL - Base URL of the Bus.
 * @param {string} token - Bearer access token obtained from getBusToken.
 * @returns {import('axios').AxiosInstance}
 */
function createBusRequest(token, axiosConfig = {}, busUrl = null, url = null) {

    const instance = axios.create({
        ...(!!url ? { url: url } : !!busUrl ? { baseURL: busURL } : {}),
        ...axiosConfig,
        headers: {
            'Content-Type': 'application/fhir+json',
            'Authorization': `Bearer ${token}`,
            ...(axiosConfig.headers || {}),
        },
    });

    if (config.debug) {
        instance.interceptors.request.use((req) => {
            const url = req.baseURL + req.url + (req.params ? '?' + new URLSearchParams(req.params).toString() : '');
            console.log(`[${new Date().toISOString()}] --> ${req.method.toUpperCase()} ${url}`);
            return req;
        });

        instance.interceptors.response.use(
            (res) => {
                console.log(`[${new Date().toISOString()}] <-- ${res.status} ${res.config.baseURL}${res.config.url}`);
                return res;
            },
            (err) => {
                const res = err.response;
                if (res) {
                    console.error(`[${new Date().toISOString()}] <-- ${res.status} ${res.config.baseURL}${res.config.url}`);
                }
                return Promise.reject(err);
            }
        );
    }

    return instance;
}

module.exports = { getBusToken, createBusRequest };
