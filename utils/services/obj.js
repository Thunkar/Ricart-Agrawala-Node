var merge = function (obj1, obj2) {
    for (var attrname in obj2) {
        obj1[attrname] = obj2[attrname];
    }
}

var generateId = function () {
    var pickFrom = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-+#%&";
    var password = "";
    for (var i = 0; i < 8; i++) {
        password += pickFrom.charAt(Math.random() * 59);
    }
    return password;
};

var getRandomInt = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.merge = merge;
exports.generateId = generateId;
exports.getRandomInt = getRandomInt;