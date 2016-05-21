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

var pendingElection = true;
var electionTimers = [];
var criticalSectionTimers = [];
var criticalSectionRequestTimers = [];
var wantedTimeoutTimers = [];
var lastRequested = new Date();
var coordinator = "-1";
var state = "RELEASED";
var answered = {};
var messages = {};
var offset = 0;

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
        clientSocket.write(JSON.stringify({ type: "HANDSHAKE", from: config.pid, timestamp: new Date(), ttl: 1 }) + "\r\n");
    });

    clientSocket.on('data', function (data) {
        try {
            var splitted = data.toString().match(/[^\r\n]+/g);
            splitted.forEach(function (line) {
                var json = JSON.parse(line);
                processMessage(server, json);
            });
        } catch (err) {
            if (err) return systemLogger.error(err.message);
        }
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
                var splitted = data.toString().match(/[^\r\n]+/g);
                splitted.forEach(function (line) {
                    var json = JSON.parse(line);
                    processMessage(client, json);
                });
            } catch (err) {
                if (err) return systemLogger.error(err.message);
            }
        });

        socket.on('end', function () {
            systemLogger.info("Client: " + client.pid + " disconnected");
            try {
                delete clients[client.pid];
            } catch (err) { }
            election();
        });

        socket.on('error', function () {
            systemLogger.error("Connection with client: " + client.pid + " dropped");
            try {
                delete clients[client.pid];
            } catch (err) { }
            election();
        });
    }).listen(process.env.PORT || config.port, function () {
        configureClient();
    });

}

// General

var send = function (message, excluded) {
    for (pid in clients) {
        var node = clients[pid];
        if (pid !== excluded) {
            node.socket.write(JSON.stringify(message) + "\r\n");
        }
    }
    if (server.pid !== excluded) {
        server.socket.write(JSON.stringify(message) + "\r\n");
    }
}


var status = function () {
    var statusObject = { me: config.pid, server: server.pid, coordinator: coordinator, state: state, clients: [] };
    for (node in clients) {
        statusObject.clients.push(node);
    }
    return statusObject;
}

var election = function () {
    systemLogger.info("Starting election, forcing out of critical section");
    state = "RELEASED";
    coordinator = "-1";
    pendingElection = true;
    electionTimers.concat(criticalSectionTimers).concat(criticalSectionRequestTimers).concat(wantedTimeoutTimers).forEach(function (timer) {
        clearTimeout(timer);
    });
    for (var i = 0; i < config.pid; i++) {
        send({ type: "ELECTION", from: config.pid, to: i + "", timestamp: new Date(), ttl: config.nodes.length })
    }
    electionTimers.push(setTimeout(function () {
        if (!pendingElection) return;
        send({ type: "COORDINATOR", from: config.pid, to: "-1", timestamp: new Date(), ttl: config.nodes.length });
        pendingElection = false;
        coordinator = config.pid;
        systemLogger.info("No one answered, I'm the coordinator");
        offset = 0;
        requestCriticalSection(0);
    }, config.electionTimeout))
}

var leaveCriticalSection = function () {
    systemLogger.info("Leaving critical section");
    state = "RELEASED";
    for (var dest in messages) {
        send({ type: "ACCEPT", from: config.pid, to: dest, timestamp: new Date(), ttl: config.nodes.length })
    }
    messages = {};
}

var enterCriticalSection = function () {
    if (pendingElection) return;
    systemLogger.info("Entering critical section");
    answered = {};
    state = "HELD";
    criticalSectionTimers.concat(criticalSectionRequestTimers).concat(wantedTimeoutTimers).forEach(function (timer) {
        clearTimeout(timer);
    });
    criticalSectionTimers.push(setTimeout(function () {
        leaveCriticalSection();
        requestCriticalSection(Math.floor(Math.random() * config.maxCriticalSectionDelay));
    }, config.criticalSectionTimeout));
}

var requestCriticalSection = function (delay) {
    if (pendingElection) return;
    criticalSectionTimers.concat(criticalSectionRequestTimers).concat(wantedTimeoutTimers).forEach(function (timer) {
        clearTimeout(timer);
    });
    criticalSectionRequestTimers.push(setTimeout(function () {
        systemLogger.info("Requested critical section access");
        answered = {};
        state = "WANTED";
        lastRequested = new Date(new Date() - offset);
        send({ type: "WANTED", from: config.pid, to: "-1", timestamp: lastRequested, ttl: config.nodes.length })
        wantedTimeoutTimers.push(setTimeout(function () {
            systemLogger.warn("Token lost, starting election");
            election();
        }, 15000 * config.nodes.length));
    }, delay));
}

var processMessage = function (node, message) {
    if (!message || message.from == config.pid || message.ttl < 1) return;
    else message.ttl--;
    if (message.type != "HANDSHAKE" && message.to != config.pid) {
        systemLogger.debug("Received a message for another node, passing it along...");
        send(message, node.pid);
        if (message.to != "-1")
            return;
    }
    systemLogger.debug(message);
    switch (message.type) {
        case "HANDSHAKE": {
            node.pid = message.from;
            if (config.nodes.length > 2 && message.from == server.pid) {
                systemLogger.warn("Loop detected");
                node.socket.end();
                server.socket.end();
            } else {
                clients[node.pid] = node;
                node.socket.write(JSON.stringify({ type: "ACKHANDSHAKE", from: config.pid, to: message.from, timestamp: new Date(), ttl: 1 }) + "\r\n");
            }
            break;
        }
        case "ACKHANDSHAKE": {
            if (config.nodes.length > 2 && clients[message.from]) {
                systemLogger.warn("Loop detected");
                server.socket.end();
                node.socket.end();
            } else {
                server.pid = message.from;
                election();
            }
            break;
        }
        case "ELECTION": {
            if (message.from < config.pid) return;
            send({ type: "ANSWER", from: config.pid, to: message.from, timestamp: new Date(), ttl: config.nodes.length });
            election();
            break;
        }
        case "ANSWER": {
            systemLogger.info("Received answer, stepping down");
            pendingElection = false;
            break;
        }
        case "COORDINATOR": {
            if (message.from > config.pid) {
                election();
                return;
            }
            systemLogger.info("Node: " + message.from + " is the coordinator, forcing myself out of the critical section");
            offset = new Date() - new Date(message.timestamp);
            coordinator = message.from;
            pendingElection = false;
            leaveCriticalSection();
            requestCriticalSection(Math.floor(Math.random() * config.maxCriticalSectionDelay));
            break;
        }
        case "WANTED": {
            if (state == "RELEASED" || lastRequested > message.timestamp) {
                send({ type: "ACCEPT", from: config.pid, to: message.from, timestamp: new Date(), ttl: config.nodes.length });
            } else {
                messages[message.from] = message;
            }
            break;
        }
        case "ACCEPT": {
            if (state != "WANTED") return;
            answered[message.from] = 1;
            if (Object.keys(answered).length == config.nodes.length - 1)
                enterCriticalSection();
            break;
        }
        default: break;
    }
    systemLogger.debug(status());
}

exports.configure = function () { configureServer() };