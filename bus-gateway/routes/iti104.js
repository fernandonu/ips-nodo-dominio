const express = require('express');
const router = express.Router();
const { createPatient, updatePatient } = require('../controllers/iti104');

// ITI-104: Patient Identity Feed FHIR
router.post('/Patient', createPatient);
router.put('/Patient/:id', updatePatient);

module.exports = router;
