var mkdirp = require('mkdirp'),
    winston = require('winston');

var servicesLogger = winston.loggers.get('services');

servicesLogger.info("Loading file utils");

var ensureExists = function (path, cb) {
    mkdirp(path, function (err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null);
            else cb(err);
        } else cb(null);
    });
};

exports.ensureExists = ensureExists;
