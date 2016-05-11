var generateId = function () {
    var pickFrom = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-+#%&";
    var id = "";
    for (var i = 0; i < 8; i++) {
        id += pickFrom.charAt(Math.random() * 59);
    }
    return id;
};

var getRandomInt = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.generateId = generateId;
exports.getRandomInt = getRandomInt;