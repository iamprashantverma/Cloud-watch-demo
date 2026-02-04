const fastify = require("fastify")({
  logger: true,
});

const AWS = require("aws-sdk");

// AWS region
const REGION = "ap-south-1"; // change as needed
const SECRET_NAME = "myapp-secret";

let SECRET_KEY = null;

// Create a Secrets Manager client
const secretsManager = new AWS.SecretsManager({ region: REGION });

async function loadSecret() {
  try {
    const data = await secretsManager.getSecretValue({ SecretId: SECRET_NAME }).promise();
    SECRET_KEY = data.SecretString;
    console.log("Secret key loaded from AWS Secrets Manager");
  } catch (err) {
    console.error("Failed to load secret key from Secrets Manager", err);
    process.exit(1);
  }
}

const users = {};

fastify.post("/signup", async (request, reply) => {
  const { username, password } = request.body;

  console.log("Signup attempt:", username);

  if (users[username]) {
    console.warn("Signup failed: user already exists:", username);
    return reply.code(409).send({ message: "User already exists" });
  }

  users[username] = {
    username,
    password,
    createdAt: new Date().toISOString(),
  };

  console.log("User signed up:", username);
  return reply.code(201).send({ message: "Signup successful" });
});

fastify.post("/login", async (request, reply) => {
  const { username, password } = request.body;

  console.log("Login attempt:", username);

  const user = users[username];
  if (!user || user.password !== password) {
    console.error("Login failed for user:", username);
    return reply.code(401).send({ message: "Invalid credentials" });
  }

  console.log("Login successful:", {
    username,
    issuedAt: new Date().toISOString(),
  });

  return reply.send({
    message: `Logged in with the secret: ${SECRET_KEY}`,
  });
});

const start = async () => {
  await loadSecret();

  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
};

start();
