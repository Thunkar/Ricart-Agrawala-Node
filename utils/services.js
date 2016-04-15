var fs = require('fs'),
    winston = require('winston');

var services = {};

var init = function () {
    try {
        var config = JSON.parse(fs.readFileSync('./config.cnf', 'utf8').toString());
    } catch (err) {
        console.error("No config");
        process.exit(-1);
    }
    services.config = config;
    require('./services/logger.js');
    var servicesLogger = winston.loggers.get('services');
    servicesLogger.info("Loading services");
    var files = fs.readdirSync("./utils/services").filter(function (file) {
        return file.indexOf(".js") != -1 && file != "logger.js";
    });

    files.forEach(function (file) {
        services[file.replace('.js', '')] = require("./services/" + file);
    });
    servicesLogger.info("Service loading completed");
}

services.init = init;

module.exports = services;
