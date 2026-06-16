const express = require('express');
const router = express.Router();
const { provideIPSTransaction, provideIPSDocumentBundle } = require('../controllers/iti65');

// ITI-65: Provide Document Bundle — variante transaction Bundle
router.post('/IPSTransaction', provideIPSTransaction);

// ITI-65: Provide Document Bundle — variante IPS document Bundle (type: document)
router.post('/IPSDocument', provideIPSDocumentBundle);

module.exports = router;
