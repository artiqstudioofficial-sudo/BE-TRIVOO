require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const logger = require("morgan");
const compression = require("compression");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const app = express();
const port = process.env.PORT || 4000;

const routerNav = require("./src/index");

// ====== BASIC ======
app.use(logger("dev"));
app.use(helmet());
app.use(compression());

app.use(express.static("public"));
app.use(fileUpload());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// ====== CORS (COOKIE SESSION BUTUH ORIGIN SPESIFIK) ======
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  // tambahkan domain produksi FE kamu kalau ada:
  // "https://homeservice.viniela.id",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // allow request tanpa origin (curl/postman/server-to-server)
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// preflight
app.options("*", cors());

// ====== SESSION STORE (REDIS) - SUPPORT ALL connect-redis VERSIONS ======
let sessionStore; // boleh undefined => express-session fallback MemoryStore (dev only)

if (process.env.REDIS_URL) {
  const { createClient } = require("redis");
  const connectRedisPkg = require("connect-redis");

  const redisClient = createClient({ url: process.env.REDIS_URL });

  redisClient.on("error", (err) => console.error("[REDIS] error:", err));
  redisClient
    .connect()
    .then(() => console.log("[REDIS] connected"))
    .catch((e) => console.error("[REDIS] connect failed:", e));

  // 1) connect-redis v7 (ESM/CJS): require("connect-redis").default.create(...)
  const v7Default = connectRedisPkg?.default;
  if (v7Default && typeof v7Default.create === "function") {
    sessionStore = v7Default.create({
      client: redisClient,
      prefix: "sess:",
    });
  }
  // 2) connect-redis versi lama: require("connect-redis")(session) => ctor
  else if (typeof connectRedisPkg === "function") {
    const RedisStoreCtor = connectRedisPkg(session);
    sessionStore = new RedisStoreCtor({
      client: redisClient,
      prefix: "sess:",
    });
  }
  // 3) varian lain: connectRedisPkg.RedisStore / connectRedisPkg.default (ctor)
  else {
    const RedisStoreCtor =
      connectRedisPkg?.RedisStore || connectRedisPkg?.default;

    if (typeof RedisStoreCtor !== "function") {
      throw new Error(
        "connect-redis export tidak cocok. Cek versi dengan: npm ls connect-redis"
      );
    }

    sessionStore = new RedisStoreCtor({
      client: redisClient,
      prefix: "sess:",
    });
  }
} else {
  console.warn("[WARN] REDIS_URL not set. Using MemoryStore (DEV ONLY).");
}

// kalau dibelakang reverse proxy (nginx/cloudflare), ini penting untuk cookie secure
app.set("trust proxy", 1);

// ====== SESSION MIDDLEWARE ======
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // undefined => MemoryStore (dev)
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // true hanya kalau HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 hari
    },
  })
);

// ====== ROUTES ======
app.use("/", routerNav);

// ====== 404 ======
app.use((req, res) => {
  res.sendStatus(404);
});

// ====== START ======
const server = app.listen(port, () => {
  console.log(`\n\t *** Server listening on PORT ${port}  ***`);
});

module.exports = server;
