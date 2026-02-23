const clientsByUserId = new Map();

const addStreamClient = (userId, res) => {
  const key = String(userId);
  const clients = clientsByUserId.get(key) || new Set();
  clients.add(res);
  clientsByUserId.set(key, clients);
};

const removeStreamClient = (userId, res) => {
  const key = String(userId);
  const clients = clientsByUserId.get(key);
  if (!clients) return;

  clients.delete(res);
  if (!clients.size) clientsByUserId.delete(key);
};

const publishToUser = (userId, payload) => {
  const clients = clientsByUserId.get(String(userId));
  if (!clients || !clients.size) return;

  const message = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      // Ignore broken stream writes
    }
  });
};

const publishToAllUsers = (payload) => {
  const message = `data: ${JSON.stringify(payload)}\n\n`;

  clientsByUserId.forEach((clients) => {
    clients.forEach((client) => {
      try {
        client.write(message);
      } catch {
        // Ignore broken stream writes
      }
    });
  });
};

export { addStreamClient, publishToAllUsers, publishToUser, removeStreamClient };

