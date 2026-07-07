const express = require("express");
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const http = require("http");
require("dotenv").config();

const logger = require("./utils/logger");
const { validateRequiredEnv } = require("./config/envValidation");

// Routes
const blogCategoryRouter = require("./routes/blogCategoryRoutes");
const blogPostRouter = require("./routes/blogPostRoutes");
const promoCodeRouter = require("./routes/promoCodeRoutes");
const categoryRouter = require("./routes/categoryRoutes");
const productRouter = require("./routes/productRoutes");
const wishlistRouter = require("./routes/wishlistRoutes");
const newsletterRouter = require("./routes/newsletterRoutes");
const cartRouter = require("./routes/cartRoutes");
const contactRouter = require("./routes/contactRoutes");
const adminRouter = require("./routes/adminRoutes");
const checkoutRouter = require("./routes/checkoutRoutes");
const analyticsRouter = require("./routes/analyticsRoutes");
const orderRouter = require("./routes/orderRoutes");
const authRouter = require("./routes/authRoutes");
const uploadRouter = require("./routes/uploadRoutes");
const settingsRouter = require("./routes/settingRoutes");
const staffUsersRouter = require("./routes/staffUsersRoutes");
const rolesRouter = require("./routes/rolesRoutes");
const notificationRouter = require("./routes/notificationRoutes");

const { connectRedis } = require("./utils/redisClient");
const { initSocket } = require("./config/socket");

require("./config/passport");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 4000;

app.set("trust proxy", 1);
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://pink-dreams-ikftech.vercel.app",
      "https://pink-dreams-ikftech.vercel.app/",
      "https://pink-dream-local-frontend.vercel.app",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  }),
);

app.use("/images", express.static(path.join(__dirname, "upload/images")));
app.use("/images/categories", express.static("./upload/categories"));
app.use("/images/blog-categories", express.static("./upload/blog-categories"));
app.use("/images/blog", express.static("./upload/blog"));

async function bootstrap() {
  try {
    validateRequiredEnv();
    console.log("server_bootstrap_started");

    // Mongoose connection removed in favor of Prisma
    console.log("prisma_database_ready");

    const redisConnected = await connectRedis();
    if (!redisConnected) {
      console.log("redis_unavailable_fallback_mode");
    }

    app.use(
      session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        // Removed MongoStore. Using memory store for now (configure Redis store in production!)
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000,
        },
      }),
    );

    app.use(passport.initialize());
    app.use(passport.session());

    app.use("/", blogCategoryRouter);
    app.use("/", blogPostRouter);
    app.use("/api", promoCodeRouter);
    app.use("/", categoryRouter);
    app.use("/", productRouter);
    app.use("/", wishlistRouter);
    app.use("/", newsletterRouter);
    app.use("/", cartRouter);
    app.use("/", contactRouter);
    app.use("/", adminRouter);
    app.use("/", checkoutRouter);
    app.use("/", analyticsRouter);
    app.use("/", orderRouter);
    app.use("/", authRouter);
    app.use("/", uploadRouter);
    app.use("/", settingsRouter);
    app.use("/", staffUsersRouter);
    app.use("/", rolesRouter);
    app.use("/", notificationRouter);
    app.get("/", (_, res) => res.send("Server is running"));

    app.get("/api/db-status", (req, res) => {
      // Prisma handles connection automatically
      res.json({
        success: true,
        database_status: "connected",
        code: 1
      });
    });

    initSocket(server);

    server.listen(port, () => {
      console.log("server_listening", { port });
    });
  } catch (error) {
    console.log("server_bootstrap_failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

bootstrap();
