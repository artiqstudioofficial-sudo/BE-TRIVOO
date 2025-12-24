require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const routerNav = require("./src/index");

const app = express();

// --------------------
// ENV + defaults
// --------------------
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

if (IS_PROD && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET wajib di production.");
}

// --------------------
// Trust proxy (IMPORTANT)
// --------------------
app.set("trust proxy", 1);

// --------------------
// Middlewares (order matters)
// --------------------
app.use(morgan(IS_PROD ? "combined" : "dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());

app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// --------------------
// CORS
// --------------------
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({
      status: 403,
      error: true,
      message: `CORS blocked for origin: ${origin}`,
    });
  }
  next();
});

// --------------------
// Session store (Redis optional)
// --------------------
let sessionStore;

async function initSessionStore() {
  if (!process.env.REDIS_URL) {
    console.warn("[WARN] REDIS_URL not set. Using MemoryStore (DEV ONLY).");
    return;
  }

  const { createClient } = require("redis");
  const connectRedisPkg = require("connect-redis");

  const redisClient = createClient({ url: process.env.REDIS_URL });

  redisClient.on("error", (err) => console.error("[REDIS] error:", err));
  await redisClient.connect();
  console.log("[REDIS] connected");

  const v7Default = connectRedisPkg?.default;
  if (v7Default && typeof v7Default.create === "function") {
    sessionStore = v7Default.create({ client: redisClient, prefix: "sess:" });
    return;
  }

  if (typeof connectRedisPkg === "function") {
    const RedisStoreCtor = connectRedisPkg(session);
    sessionStore = new RedisStoreCtor({ client: redisClient, prefix: "sess:" });
    return;
  }

  const RedisStoreCtor =
    connectRedisPkg?.RedisStore || connectRedisPkg?.default;
  if (typeof RedisStoreCtor !== "function") {
    throw new Error(
      "connect-redis export tidak cocok. Cek versi: npm ls connect-redis"
    );
  }

  sessionStore = new RedisStoreCtor({ client: redisClient, prefix: "sess:" });
}

function buildSessionOptions() {
  return {
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    rolling: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  };
}

// --------------------
// Error handler
// --------------------
function errorHandler(err, _req, res, _next) {
  console.error("[ERROR]", err);
  res.status(500).json({
    status: 500,
    error: true,
    message: IS_PROD ? "Internal Server Error" : String(err?.message || err),
  });
}

// --------------------
// Bootstrap server
// --------------------
async function start() {
  await initSessionStore();

  app.use(session(buildSessionOptions()));

  app.use("/", routerNav);

  app.use((_, res) => res.sendStatus(404));

  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    console.log(`\n\t*** Server listening on PORT ${PORT} (${NODE_ENV}) ***`);
  });

  module.exports = server;
}

start().catch((e) => {
  console.error("[FATAL] failed to start:", e);
  process.exit(1);
});
