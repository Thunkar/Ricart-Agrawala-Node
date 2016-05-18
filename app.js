var winston = require('winston'),
    services = require('./utils/services.js'),
    net = require('net');

services.init();
config = services.config;
var port = process.env.PORT || config.port;
config.pid = process.env.PID || config.pid;
config.location = config.address + ":" + port;

var systemLogger = winston.loggers.get("system");

services.fileUtils.ensureExists("./logs", function(err) { if (err) systemLogger.error(err.message) });

process.on('SIGINT', function () {
    systemLogger.info("Shutting down...");
    process.exit();
});

networkController = require('./controllers/networkController.js');
networkController.configure();