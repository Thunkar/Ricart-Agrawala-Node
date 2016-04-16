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

Array.prototype.pull = function (object) {
    return this.splice(this.indexOf(object), 1);
};


Array.prototype.findByAttr = function (key, value) {
    for (var i = 0; i < this.length; i++) {
        if (this[i][key] == value)
            return this[i];
    }
    return null;
}

Array.prototype.findIdByAttr = function (key, value) {
    for (var i = 0; i < this.length; i++) {
        if (this[i][key] == value)
            return i;
    }
    return -1;
}
