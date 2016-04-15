var winston = require('winston'),
    services = require('./utils/services.js'),
    config = services.config;

services.init();

var systemLogger = winston.loggers.get("system");

services.fileUtils.ensureExists("./logs", function(err) { if (err) systemLogger.error(err.message) });