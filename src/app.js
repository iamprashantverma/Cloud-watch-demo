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
  console.log("Secret key and port loaded from AWS Secrets Manager:", { SECRET_KEY, PORT });
}

const users = {};

fastify.post("/signup", async (request, reply) => {
  const { name, email, password } = request.body;
  console.log("Signup attempt:", email);

  if (users[email]) {
    console.warn("Signup failed: user already exists:", email);
    return reply.code(409).send({ message: "User already exists" });
  }

  users[email] = {
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  console.log("User signed up:", email);
  return reply.code(201).send({ message: "Signup successful" });
});

fastify.post("/login", async (request, reply) => {
  const { email, password } = request.body;
  console.log("Login attempt:", email);

  const user = users[email];
  if (!user || user.password !== password) {
    console.error("Login failed for user:", email);
    return reply.code(401).send({ message: "Invalid credentials" });
  }

  console.log("Login successful:", { email, issuedAt: new Date().toISOString() });
  return reply.send({ message: `Logged in with the secret: ${SECRET_KEY}` });
});

fastify.get("/users", async (request, reply) => {
  console.log("Fetching all users");
  return reply.send(Object.values(users).map(u => ({ name: u.name, email: u.email, createdAt: u.createdAt })));
});

fastify.get("/users/:email", async (request, reply) => {
  const { email } = request.params;
  console.log("Fetching user:", email);

  const user = users[email];
  if (!user) {
    return reply.code(404).send({ message: "User not found" });
  }
  return reply.send({ name: user.name, email: user.email, createdAt: user.createdAt });
});

fastify.put("/users/:email/password", async (request, reply) => {
  const { email } = request.params;
  const { password } = request.body;
  console.log("Updating password for user:", email);

  const user = users[email];
  if (!user) {
    return reply.code(404).send({ message: "User not found" });
  }

  user.password = password;
  return reply.send({ message: "Password updated successfully" });
});

fastify.delete("/users/:email", async (request, reply) => {
  const { email } = request.params;
  console.log("Deleting user:", email);

  if (!users[email]) {
    return reply.code(404).send({ message: "User not found" });
  }

  delete users[email];
  return reply.send({ message: "User deleted successfully" });
});

const start = async () => {
  await loadSecret();

  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
};

start();
