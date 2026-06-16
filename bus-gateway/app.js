require('./config');

var createError = require('http-errors');
var express = require('express');
var logger = require('morgan');

var iti65Router = require('./routes/iti65');
var iti67Router = require('./routes/iti67');
var iti78Router = require('./routes/iti78');
var iti104Router = require('./routes/iti104');

var app = express();

app.use(logger('dev'));
app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));

// ITI-65: Provide Document Bundle  → POST /fhir/IPSTransaction (transaction Bundle)
//                                    POST /fhir/IPSDocument  (IPS document Bundle)
app.use('/fhir', iti65Router);

// ITI-67: Find Document References → GET /fhir/DocumentReference
app.use('/fhir', iti67Router);

// ITI-78: Patient Demographics     → GET /fhir/Patient, GET /fhir/Patient/:id
app.use('/fhir', iti78Router);

// ITI-104: Patient Identity Feed   → POST /fhir/Patient, PUT /fhir/Patient/:id
app.use('/fhir', iti104Router);

// 404
app.use(function (req, res, next) {
    const host = req.get('host') || 'localhost';
    const protocol = req.protocol;
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    const headerFlags = Object.entries(req.headers)
        .map(([k, v]) => `-H '${k}: ${v}'`)
        .join(' \\\n     ');

    let curlCmd = `curl -X ${req.method} '${fullUrl}' \\\n     ${headerFlags}`;

    if (req.body && Object.keys(req.body).length > 0) {
        curlCmd += ` \\\n     -d '${JSON.stringify(req.body)}'`;
    }

    console.warn(`[${new Date().toISOString()}] 404 Not Found\n${curlCmd}`);
    next(createError(404));
});

// Error handler
app.use(function (err, req, res, _next) {
    // Error proveniente de HAPI FHIR o del Bus: reenviar la respuesta tal como llegó
    if (err.response) {
        const status = err.response.status;
        console.warn(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${status} (upstream)`);
        const contentType = err.response.headers?.['content-type'];
        if (contentType) res.setHeader('Content-Type', contentType);
        return res.status(status).json(err.response.data);
    }

    const status = err.status || 500;
    if (status >= 500) {
        console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${status}`, err);
    } else {
        console.warn(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${status}: ${err.message}`);
    }
    res.status(status).json({
        resourceType: 'OperationOutcome',
        issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: err.message,
        }],
    });
});

module.exports = app;
