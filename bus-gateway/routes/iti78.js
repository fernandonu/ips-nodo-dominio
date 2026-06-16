const express = require('express');
const router = express.Router();
const { listPatient, getPatientById } = require('../controllers/iti78');

// ITI-78: Mobile Patient Demographics Query
router.get('/Patient', listPatient);
router.get('/Patient/:id', getPatientById);

module.exports = router;
