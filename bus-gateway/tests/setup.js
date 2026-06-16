process.env.BUS_URL = 'http://bus-host:8080';
process.env.BUS_JWT_SECRET = 'test-secret';
process.env.BUS_ISSUER = 'https://test-repositorio-url';
process.env.MPI_SCOPE = 'Patient/*.read,Patient/*.write';
process.env.DOCUMENT_REGISTRY_SCOPE = 'DocumentReference/*.read,DocumentReference/*.write';
process.env.FHIR_URL = 'http://hapi-fhir-host:8080/fhir';
process.env.MPI_URL = 'http://mpi-host:8080';
process.env.DOCUMENT_REGISTRY_URL = 'http://document-registry-host:8080';
