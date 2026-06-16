const express = require('express');
const router = express.Router();
const { listDocumentReference } = require('../controllers/iti67');

// ITI-67: Find Document References
router.get('/DocumentReference', listDocumentReference);

module.exports = router;
