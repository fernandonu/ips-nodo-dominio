require('dotenv').config();
const axios = require('axios');
const { getBusToken, createBusRequest } = require('../../utils/busAuth');

jest.mock('axios');

const BUS_URL = process.env.BUS_URL;
const BUS_JWT_SECRET = process.env.BUS_JWT_SECRET;
const BUS_ISSUER = process.env.BUS_ISSUER;
const BUS_SCOPE = process.env.MPI_SCOPE;

beforeEach(() => {
    jest.clearAllMocks();
});

/**
 * Decodes a JWT without verifying the signature.
 */
function decodeJwt(jwt) {
    const [header, payload] = jwt.split('.');
    return {
        header: JSON.parse(Buffer.from(header, 'base64').toString()),
        payload: JSON.parse(Buffer.from(payload, 'base64').toString()),
    };
}

describe('getBusToken', () => {
    it('POSTs to /bus-auth/v2/auth on the given busURL', async () => {
        axios.post.mockResolvedValue({ data: 'access-token' });

        await getBusToken(BUS_URL, BUS_JWT_SECRET, BUS_ISSUER, BUS_SCOPE);

        expect(axios.post).toHaveBeenCalledWith(
            `${BUS_URL}/bus-auth/v2/auth`,
            expect.any(Object)
        );
    });

    it('sends the correct grantType, scope and clientAssertionType', async () => {
        axios.post.mockResolvedValue({ data: 'access-token' });

        await getBusToken(BUS_URL, BUS_JWT_SECRET, BUS_ISSUER, BUS_SCOPE);

        const body = axios.post.mock.calls[0][1];
        expect(body.grantType).toBe('client_credentials');
        expect(body.scope).toBe(BUS_SCOPE);
        expect(body.clientAssertionType).toBe(
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
        );
    });

    it('sends a HS256 JWT signed with the secret as clientAssertion', async () => {
        axios.post.mockResolvedValue({ data: 'access-token' });

        await getBusToken(BUS_URL, BUS_JWT_SECRET, BUS_ISSUER, BUS_SCOPE);

        const { clientAssertion } = axios.post.mock.calls[0][1];
        expect(clientAssertion.split('.')).toHaveLength(3);

        const { header } = decodeJwt(clientAssertion);
        expect(header.alg).toBe('HS256');
        expect(header.typ).toBe('JWT');
    });

    it('JWT payload contains the correct issuer and expiration fields', async () => {
        axios.post.mockResolvedValue({ data: 'access-token' });

        const before = Math.floor(Date.now() / 1000);
        await getBusToken(BUS_URL, BUS_JWT_SECRET, BUS_ISSUER, BUS_SCOPE);
        const after = Math.floor(Date.now() / 1000);

        const { clientAssertion } = axios.post.mock.calls[0][1];
        const { payload } = decodeJwt(clientAssertion);

        expect(payload.iss).toBe(BUS_ISSUER);
        expect(payload.iat).toBeGreaterThanOrEqual(before);
        expect(payload.iat).toBeLessThanOrEqual(after);
        expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('returns the accessToken field from the bus auth response', async () => {
        const tokenResponse = { accessToken: 'abc123', tokenType: 'bearer', expiresIn: 180000 };
        axios.post.mockResolvedValue({ data: tokenResponse });

        const result = await getBusToken(BUS_URL, BUS_JWT_SECRET, BUS_ISSUER, BUS_SCOPE);

        expect(result).toBe('abc123');
    });
});

describe('createBusRequest', () => {
    it('creates an axios instance with Authorization and Content-Type headers', () => {
        const mockInstance = { get: jest.fn(), post: jest.fn() };
        axios.create.mockReturnValue(mockInstance);

        const token = 'my-token';
        createBusRequest(token);

        expect(axios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: {
                    'Content-Type': 'application/fhir+json',
                    'Authorization': `Bearer ${token}`,
                },
            })
        );
    });
});
