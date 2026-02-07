const fastify = require("fastify")({
  logger: true,
});

const AWS = require("aws-sdk");

const REGION = "ap-south-1";
const SECRET_NAME = "myapp-secret";

let SECRET_KEY = null;
let PORT = 3000;

const secretsManager = new AWS.SecretsManager({ region: REGION });

async function loadSecret() {
  const data = await secretsManager.getSecretValue({ SecretId: SECRET_NAME }).promise();
  const secret = JSON.parse(data.SecretString);
  SECRET_KEY = secret.APP_SECRET_KEY;
  PORT = secret.PORT || PORT;
  fastify.log.info("Secret key and port loaded from AWS Secrets Manager", { SECRET_KEY, PORT });
}

const users = {};

fastify.post("/signup", async (request, reply) => {
  const { name, email, password } = request.body;
  fastify.log.info("Signup attempt", { email });

  if (users[email]) {
    fastify.log.warn("Signup failed: user already exists", { email });
    return reply.code(409).send({ message: "User already exists" });
  }

  users[email] = {
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  fastify.log.info("User signed up", { email });
  return reply.code(201).send({ message: "Signup successful" });
});


fastify.get("/health", async () => {
  return { status: "ok", time: new Date().toISOString() };
});

fastify.get("/stats", async () => {
  const list = Object.values(users);

  return {
    totalUsers: list.length,
    lastSignup: list[list.length - 1]?.createdAt || null,
  };
});

fastify.post("/login", async (request, reply) => {
  const { email, password } = request.body;
  fastify.log.info("Login attempt", { email });

  const user = users[email];
  if (!user || user.password !== password) {
    fastify.log.error("Login failed for user", { email });
    return reply.code(401).send({ message: "Invalid credentials" });
  }

  fastify.log.info("Login successful", { email, issuedAt: new Date().toISOString() });
  return reply.send({ message: `Logged in with the secret: ${SECRET_KEY}` });
});

fastify.get("/users", async (request, reply) => {
  fastify.log.info("Fetching all users");
  return reply.send(Object.values(users).map(u => ({ name: u.name, email: u.email, createdAt: u.createdAt })));
});

fastify.get("/users/:email", async (request, reply) => {
  const { email } = request.params;
  fastify.log.info("Fetching user", { email });

  const user = users[email];
  if (!user) {
    fastify.log.warn("User not found", { email });
    return reply.code(404).send({ message: "User not found" });
  }
  return reply.send({ name: user.name, email: user.email, createdAt: user.createdAt });
});

fastify.put("/users/:email/password", async (request, reply) => {
  const { email } = request.params;
  const { password } = request.body;
  fastify.log.info("Updating password for user", { email });

  const user = users[email];
  if (!user) {
    fastify.log.warn("User not found for password update", { email });
    return reply.code(404).send({ message: "User not found" });
  }

  user.password = password;
  fastify.log.info("Password updated successfully", { email });
  return reply.send({ message: "Password updated successfully" });
});

fastify.delete("/users/:email", async (request, reply) => {
  const { email } = request.params;
  fastify.log.info("Deleting user", { email });

  if (!users[email]) {
    fastify.log.warn("User not found for deletion", { email });
    return reply.code(404).send({ message: "User not found" });
  }

  delete users[email];
  fastify.log.info("User deleted successfully", { email });
  return reply.send({ message: "User deleted successfully" });
});

const start = async () => {
  await loadSecret();

  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    fastify.log.info(`Server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error("Server startup failed", err);
    process.exit(1);
  }
};

start();
