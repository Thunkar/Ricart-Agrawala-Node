var winston = require('winston'),
    services = require('../utils/services.js'),
    net = require('net'),
    config = services.config;

var systemLogger = winston.loggers.get("system");

var getIndex = function() {
    var result = 0;
    services.config.nodes.forEach(function(pid, index) {
        if (pid == config.pid) {
            result = index;
            return;
        }
    });
    return result;
}

var getParent = function() {
    var index = getIndex();
    if (index <= 0) return null;
    return services.config.nodes[(getIndex() - 1) / 2];
};

//Client 
var clientSocket;

var client;

var configureClient = function() {

    if (clientSocket) {
        clientSocket.destroy();
    }

    clientSocket = new net.Socket();

    clientPid = getParent();
    if (clientPid == null) return;
    client = { socket: clientSocket, id: clientPid };
    config.clientPort = clientPid.split(":")[1];
    config.clientAddress = clientPid.split(":")[0];

    clientSocket.connect(config.clientPort, config.clientAddress, function() {
        systemLogger.info("Connected to server");
    });

    clientSocket.on('data', function(d) {
        try {
            var data = JSON.parse(d);
        } catch (err) { }
        systemLogger.debug(data);
        messageProcessor.process(client, data);
    });

    clientSocket.on('error', function(err) {
        systemLogger.error("Lost connection with server: " + err.message);
    });

    clientSocket.on('end', function() {
        clientSocket.destroy();
        configureClient();
    });
}

var sendUpstream = function(message, excluded) {
    if (client.id !== excluded)
        client.socket.write(message);
}

// Server 
var clients = {};

var configureServer = function() {

    systemLogger.info("Server started");

    net.createServer(function(socket) {

        systemLogger.info("Client connected");

        var id = socket.remoteAddress + ":" + socket.remotePort;
        clients[id] = { socket: socket, pid: id };

        socket.on('data', function(data) {
            try {
                data = JSON.parse(data);
                systemLogger.debug(data);
            } catch (err) {
                if (err) return systemLogger.error(err.message);
            }
            messageProcessor.process(client, data);
        });

        socket.on('end', function() {
            systemLogger.info("Client: " + client.id + " disconnected");
            delete clients[client.id];
        });

        socket.on('error', function() {
            systemLogger.error("Connection with client: " + client.id + " dropped");
        });

    }).listen(config.port);

}

var sendDownstream = function(message, excluded) {
    for (client in clients) {
        if (client.id !== excluded)
            client.write(message);
    }
}

// General

var broadcast = function(message, excluded) {
    if (client)
        sendUpstream(message, excluded);
    sendDownstream(message, excluded);
}


var processMessage = function(client, data) {
    if (message.to != "BROADCAST" && message.to != services.config.pid) {
        systemLogger.debug("Received a message for another node, passing it along...");
        broadcast(data, client.id);
        return;
    }
    systemLogger.debug("Received a message");
    switch (message.type) {

        default: return;
    }
}

exports.configure = function() { configureClient(); configureServer() };