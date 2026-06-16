require('dotenv').config();
const axios = require('axios');
const { getBusToken } = require('../../utils/busAuth');
const {
    createDocumentReference,
    findDocumentReferenceBySubject,
    findDocumentReferenceByPatient,
    searchDocumentReference,
} = require('../../services/documentReference');

jest.mock('axios');

const BUS_URL = process.env.BUS_URL;
const BUS_JWT_SECRET = process.env.BUS_JWT_SECRET;
const BUS_ISSUER = process.env.BUS_ISSUER;
const BUS_SCOPE = process.env.DOCUMENT_REGISTRY_SCOPE;

const mockRequest = { get: jest.fn(), post: jest.fn() };

beforeEach(() => {
    jest.clearAllMocks();
    axios.create.mockReturnValue(mockRequest);
});

async function acquireToken() {
    axios.post.mockResolvedValueOnce({ data: { accessToken: 'acquired-token' } });
    return getBusToken(BUS_URL, BUS_JWT_SECRET, BUS_ISSUER, BUS_SCOPE);
}

// Internal URL used by the document registry (replaced by maskPrivateURL)
const INTERNAL_REGISTRY_BASE = 'https://federador.qa-bus-interoperabilidad.svc.cluster.local:8080/fhir/DocumentReference';

const DOCUMENT_REFERENCE = {
    resourceType: 'DocumentReference',
    status: 'current',
    subject: {
        identifier: { system: 'https://federador.msal.gob.ar/patient-id', value: '5037097' },
    },
};

describe('createDocumentReference', () => {
    it('POSTs a DocumentReference to the registry and returns the created resource', async () => {
        const token = await acquireToken();
        const responseData = { resourceType: 'DocumentReference', id: 'dr-001' };
        mockRequest.post.mockResolvedValue({
            data: {},
            headers: { location: `${INTERNAL_REGISTRY_BASE}/dr-001` },
        });
        mockRequest.get.mockResolvedValue({ data: responseData });

        const result = await createDocumentReference(token, DOCUMENT_REFERENCE);

        expect(mockRequest.post).toHaveBeenCalledWith(expect.anything(), DOCUMENT_REFERENCE);
        expect(result).toEqual(responseData);
    });
});

describe('findDocumentReferenceBySubject', () => {
    it('GETs /fhir/DocumentReference with subject param as system|value', async () => {
        const token = await acquireToken();
        const bundle = { resourceType: 'Bundle', entry: [] };
        mockRequest.get.mockResolvedValue({ data: bundle });

        const result = await findDocumentReferenceBySubject(
            token,
            'https://federador.msal.gob.ar/patient-id',
            '5037097'
        );

        expect(mockRequest.get).toHaveBeenCalledWith(
            expect.anything(),
            { params: { subject: 'https://federador.msal.gob.ar/patient-id|5037097' } }
        );
        expect(result).toEqual(bundle);
    });
});

describe('findDocumentReferenceByPatient', () => {
    it('GETs /fhir/DocumentReference with patient ID as subject param', async () => {
        const token = await acquireToken();
        const bundle = { resourceType: 'Bundle', entry: [] };
        mockRequest.get.mockResolvedValue({ data: bundle });

        const result = await findDocumentReferenceByPatient(token, 'http://mpi/fhir/Patient/123');

        expect(mockRequest.get).toHaveBeenCalledWith(
            expect.anything(),
            { params: { subject: 'http://mpi/fhir/Patient/123' } }
        );
        expect(result).toEqual(bundle);
    });
});

describe('searchDocumentReference', () => {
    it('GETs /fhir/DocumentReference with subject, custodian and type params', async () => {
        const token = await acquireToken();
        const bundle = { resourceType: 'Bundle', entry: [] };
        mockRequest.get.mockResolvedValue({ data: bundle });

        const subject = { system: 'https://federador.msal.gob.ar/patient-id', value: '5037097' };
        const custodian = { system: 'https://federador.msal.gob.ar/uri', value: 'efector-001' };
        const type = { system: 'http://loinc.org', value: '60591-5' };

        const result = await searchDocumentReference(token, subject, custodian, type);

        expect(mockRequest.get).toHaveBeenCalledWith(
            expect.anything(),
            {
                params: {
                    subject: 'https://federador.msal.gob.ar/patient-id|5037097',
                    custodian: 'https://federador.msal.gob.ar/uri|efector-001',
                    type: 'http://loinc.org|60591-5',
                },
            }
        );
        expect(result).toEqual(bundle);
    });
});
