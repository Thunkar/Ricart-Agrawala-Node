var winston = require('winston'),
    services = require('../utils/services.js'),
    net = require('net'),
    config = services.config;

var systemLogger = winston.loggers.get("system");

var getIndex = function () {
    var result = 0;
    services.config.nodes.forEach(function (location, index) {
        if (location == config.location) {
            result = index;
            return;
        }
    });
    return result;
}

var getParent = function () {
    var index = getIndex();
    var parentIndex = index;
    do
        parentIndex = services.obj.getRandomInt(0, services.config.nodes.length - 1);
    while (parentIndex == index);
    return services.config.nodes[parentIndex];
};

//Client 

var server;

var configureClient = function () {

    var clientSocket = new net.Socket();

    clientSocket.setTimeout(1000, function () {
        if (clientSocket.connecting) {
            clientSocket.destroy();
            clientSocket.end();
            configureClient();
        }
    });

    var serverLocation = getParent();
    server = { socket: clientSocket };
    config.serverPort = serverLocation.split(":")[1];
    config.serverAddress = serverLocation.split(":")[0];

    clientSocket.connect(config.serverPort, config.serverAddress, function () {
        systemLogger.info("Connected to server");
        clientSocket.write(JSON.stringify({ type: "HANDSHAKE", from: config.pid, timestamp: new Date() }) + "\r\n");
    });

    clientSocket.on('data', function (d) {
        try {
            var data = JSON.parse(d);
        } catch (err) { }
        processMessage(server, data);
    });

    clientSocket.on('error', function (err) {
        systemLogger.error("Lost connection with server: " + err.message);
        configureClient();
    });

    clientSocket.on('end', function () {
        systemLogger.error("Connection with server dropped");
        configureClient();
    });
}

// Server 

var clients = {};

var configureServer = function () {

    systemLogger.info("Server started");

    net.createServer(function (socket) {

        systemLogger.info("Client connected");

        var client = { socket: socket };

        socket.on('data', function (data) {
            try {
                data = JSON.parse(data);
            } catch (err) {
                if (err) return systemLogger.error(err.message);
            }
            processMessage(client, data);
        });

        socket.on('end', function () {
            systemLogger.info("Client: " + client.pid + " disconnected");
            try {
                delete clients[client.pid];
            } catch (err) { }
        });

        socket.on('error', function () {
            systemLogger.error("Connection with client: " + client.pid + " dropped");
            try {
                delete clients[client.pid];
            } catch (err) { }
        });

    }).listen(process.env.PORT || config.port, function () {
        configureClient();
    });

}

// General

var broadcast = function (message, excluded) {
    for (node in clients) {
        if (node !== excluded)
            node.socket.write(message);
    }
    if (server.pid != excluded)
        server.socket.write(message);
}


var status = function () {
    var statusObject = { me: config.pid, server: server.pid, clients: [] };
    for (node in clients) {
        statusObject.clients.push(node);
    }
    return statusObject;
}


var processMessage = function (node, message) {
    if (message.type != "HANDSHAKE" && message.to != config.pid) {
        systemLogger.debug("Received a message for another node, passing it along...");
        broadcast(data, node.pid);
        return;
    }
    systemLogger.debug("Received a message");
    systemLogger.debug(message);
    switch (message.type) {
        case "HANDSHAKE": {
            node.pid = message.from;
            if (config.nodes.length > 2 && message.from == server.pid) {
                systemLogger.warn("Loop detected");
                node.socket.end();
            } else {
                clients[node.pid] = node;
                node.socket.write(JSON.stringify({ type: "ACKHANDSHAKE", from: config.pid, to: message.from, timestamp: new Date() }) + "\r\n");
            }
            break;
        }
        case "ACKHANDSHAKE": {
            if (config.nodes.length > 2 && clients[message.from]) {
                systemLogger.warn("Loop detected");
                server.socket.end();
            } else {
                server.pid = message.from;
            }
            break;
        }
        default: break;
    }
    systemLogger.debug(status());
}

exports.configure = function () { configureServer() };