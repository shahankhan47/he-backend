const WebSocket = require("ws")

function setupWebSocketProxy(server) {
  const wss = new WebSocket.WebSocketServer({ server, path: "/api/chat" });

  wss.on("connection", (clientWs, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    const coreWs = new WebSocket(
      `${process.env.PYTHON_URL}/chat-pro?token=${encodeURIComponent(token)}`
    );

    // forward frontend → core
    clientWs.on("message", (msg) => {
      if (coreWs.readyState === WebSocket.OPEN) {
        coreWs.send(JSON.stringify(JSON.parse(msg)));
      }
    });

    // forward core → frontend
    coreWs.on("message", (msg) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(msg.toString());
      }
    });

    const closeBoth = () => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
      if (coreWs.readyState === WebSocket.OPEN) coreWs.close();
    };

    clientWs.on("close", closeBoth);
    coreWs.on("close", closeBoth);
    clientWs.on("error", closeBoth);
    coreWs.on("error", closeBoth);
  });
}

module.exports = setupWebSocketProxy;