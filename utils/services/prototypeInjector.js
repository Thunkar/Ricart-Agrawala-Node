var winston = require('winston');

var servicesLogger = winston.loggers.get('services');

servicesLogger.info("Injecting prototypes");

Array.prototype.dropDups = function () {
    var prims = { "boolean": {}, "number": {}, "string": {} }, objs = [];
    
    return this.filter(function (item) {
        var type = typeof item;
        if (type in prims)
            return prims[type].hasOwnProperty(item) ? false : (prims[type][item] = true);
        else
            return objs.indexOf(item) >= 0 ? false : objs.push(item);
    });
};