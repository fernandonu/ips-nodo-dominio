require('dotenv').config();
const axios = require('axios');
const { getBusToken } = require('../../utils/busAuth');
const { createPatient, findPatientById, findPatient, findPatientByMatch } = require('../../services/patient');

jest.mock('axios');

const BUS_URL = process.env.BUS_URL;
const BUS_JWT_SECRET = process.env.BUS_JWT_SECRET;
const BUS_ISSUER = process.env.BUS_ISSUER;
const BUS_SCOPE = process.env.MPI_SCOPE;

const mockRequest = { get: jest.fn(), post: jest.fn(), put: jest.fn() };

beforeEach(() => {
    jest.clearAllMocks();
    axios.create.mockReturnValue(mockRequest);
});

async function acquireToken() {
    axios.post.mockResolvedValueOnce({ data: { accessToken: 'acquired-token' } });
    return getBusToken(BUS_URL, BUS_JWT_SECRET, BUS_ISSUER, BUS_SCOPE);
}

// Internal URL used by the MPI service (replaced by maskPrivateURL)
const INTERNAL_MPI_BASE = 'https://federador.qa-bus-interoperabilidad.svc.cluster.local:8080/masterfile-federacion-service/fhir/Patient';

describe('createPatient', () => {
    it('POSTs the patient to the MPI and returns the created resource', async () => {
        const token = await acquireToken();
        const patient = { resourceType: 'Patient', id: '1' };
        const responseData = { resourceType: 'Patient', id: '1', meta: {} };
        mockRequest.post.mockResolvedValue({
            data: {},
            headers: { location: `${INTERNAL_MPI_BASE}/1` },
        });
        mockRequest.get.mockResolvedValue({ data: responseData });

        const result = await createPatient(token, patient);

        expect(mockRequest.post).toHaveBeenCalledWith(expect.anything(), patient);
        expect(result).toEqual(responseData);
    });
});

describe('findPatientById', () => {
    it('GETs the patient by ID and returns response data', async () => {
        const token = await acquireToken();
        const responseData = { resourceType: 'Patient', id: '42' };
        mockRequest.get.mockResolvedValue({ data: responseData });

        const result = await findPatientById(token, '42');

        expect(mockRequest.get).toHaveBeenCalledWith(expect.anything());
        expect(result).toEqual(responseData);
    });
});

describe('findPatient', () => {
    it('GETs /fhir/Patient with no params when criteria is empty', async () => {
        const token = await acquireToken();
        const bundle = { resourceType: 'Bundle', entry: [] };
        mockRequest.get.mockResolvedValue({ data: bundle });

        const result = await findPatient(token, {});

        expect(mockRequest.get).toHaveBeenCalledWith(expect.anything(), { params: {} });
        expect(result).toEqual(bundle);
    });

    it('maps criteria fields to query params', async () => {
        const token = await acquireToken();
        mockRequest.get.mockResolvedValue({ data: {} });

        await findPatient(token, {
            name: 'Juan',
            family: 'Perez',
            birthdate: '1983-04-17',
            gender: 'male',
            phone: '1141233100',
        });

        expect(mockRequest.get).toHaveBeenCalledWith(expect.anything(), {
            params: {
                name: 'Juan',
                family: 'Perez',
                birthdate: '1983-04-17',
                gender: 'male',
                phone: '1141233100',
            },
        });
    });

    it('passes the identifier param directly when provided as system|value string', async () => {
        const token = await acquireToken();
        mockRequest.get.mockResolvedValue({ data: {} });

        await findPatient(token, { identifier: 'http://www.renaper.gob.ar/dni|30945027' });

        expect(mockRequest.get).toHaveBeenCalledWith(expect.anything(), {
            params: { identifier: 'http://www.renaper.gob.ar/dni|30945027' },
        });
    });
});

describe('findPatientByMatch', () => {
    it('POSTs a Parameters resource to $match', async () => {
        const token = await acquireToken();
        const patient = { resourceType: 'Patient', id: '1' };
        const bundle = { resourceType: 'Bundle', entry: [] };
        mockRequest.post.mockResolvedValue({ data: bundle });

        const result = await findPatientByMatch(token, patient);

        expect(mockRequest.post).toHaveBeenCalledWith(expect.anything(), {
            resourceType: 'Parameters',
            parameter: [{ name: 'resource', resource: patient }],
        });
        expect(result).toEqual(bundle);
    });

    it('includes count parameter when provided', async () => {
        const token = await acquireToken();
        const patient = { resourceType: 'Patient' };
        mockRequest.post.mockResolvedValue({ data: {} });

        await findPatientByMatch(token, patient, 3);

        expect(mockRequest.post).toHaveBeenCalledWith(expect.anything(), {
            resourceType: 'Parameters',
            parameter: [
                { name: 'resource', resource: patient },
                { name: 'count', valueInteger: 3 },
            ],
        });
    });

    it('does not include count parameter when not provided', async () => {
        const token = await acquireToken();
        const patient = { resourceType: 'Patient' };
        mockRequest.post.mockResolvedValue({ data: {} });

        await findPatientByMatch(token, patient);

        const call = mockRequest.post.mock.calls[0];
        const parameters = call[1];
        expect(parameters.parameter).toHaveLength(1);
    });
});
