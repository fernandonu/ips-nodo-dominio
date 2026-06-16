const pino = require('pino')
const config = require('../config')


const pinoConfig = {
    level: config.logging.level,
    depthLimit: config.logging.depthLimit,
    edgeLimit: config.logging.edgeLimit,
    msgPrefix: config.logging.msgPrefix,
    enabled: config.logging.enabled,
    crlf: config.logging.crlf,
    messageKey: config.logging.messageKey,
    errorKey: config.logging.errorKey,
    nestedKey: config.logging.nestedKey,
}


const logger = pino(pinoConfig, process.stderr);

module.exports = { logger }