const prisma = require("../utils/prismaClient");

// Newsletter subscription endpoint
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email, name = "", source = "website" } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Check if already subscribed
    let existingSubscriber = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingSubscriber) {
      if (existingSubscriber.status === "active") {
        return res.json({
          success: true,
          message: "You are already subscribed to our newsletter!",
          alreadySubscribed: true,
        });
      } else if (existingSubscriber.status === "unsubscribed") {
        // Resubscribe
        existingSubscriber = await prisma.newsletter.update({
          where: { id: existingSubscriber.id },
          data: {
            status: "active",
            subscribedAt: new Date(),
            unsubscribedAt: null,
            ...(name ? { name } : {})
          }
        });

        return res.json({
          success: true,
          message:
            "Welcome back! You have been resubscribed to our newsletter.",
          resubscribed: true,
        });
      }
    }

    // Generate verification token
    const verificationToken =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // Create new subscriber
    const subscriber = await prisma.newsletter.create({
      data: {
        email: email.toLowerCase(),
        name: name,
        status: "active", // For now, we'll set as active immediately
        subscriptionSource: source,
        ipAddress:
          req.headers["x-forwarded-for"] || req.connection.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
        verificationToken: verificationToken,
        emailVerified: false, // In production, send verification email
      }
    });

    // In production, you would send a welcome email here

    res.json({
      success: true,
      message: "Thank you for subscribing! Welcome to Pink Dreams newsletter.",
      subscriber: {
        email: subscriber.email,
        name: subscriber.name,
        subscribedAt: subscriber.subscribedAt,
      },
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);

    // Prisma Unique Constraint Violation
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: "This email is already subscribed to our newsletter",
      });
    }

    res.status(500).json({
      success: false,
      message:
        "Sorry, there was an error processing your subscription. Please try again.",
    });
  }
};

// Newsletter unsubscribe endpoint
exports.unsubscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const subscriber = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our newsletter list",
      });
    }

    if (subscriber.status === "unsubscribed") {
      return res.json({
        success: true,
        message: "You are already unsubscribed from our newsletter",
      });
    }

    // Update subscription status
    await prisma.newsletter.update({
      where: { id: subscriber.id },
      data: {
        status: "unsubscribed",
        unsubscribedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: "You have been successfully unsubscribed from our newsletter",
    });
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);
    res.status(500).json({
      success: false,
      message:
        "Sorry, there was an error processing your request. Please try again.",
    });
  }
};

// Get newsletter statistics (admin endpoint)
exports.getNewsletterStats = async (req, res) => {
  try {
    const totalSubscribers = await prisma.newsletter.count();
    const activeSubscribers = await prisma.newsletter.count({ where: { status: "active" } });
    const unsubscribedCount = await prisma.newsletter.count({ where: { status: "unsubscribed" } });
    const pendingCount = await prisma.newsletter.count({ where: { status: "pending" } });

    // Monthly subscription growth using Raw SQL for MySQL
    const monthlyGrowthRaw = await prisma.$queryRaw`
      SELECT YEAR(subscribedAt) as year, MONTH(subscribedAt) as month, COUNT(*) as count 
      FROM Newsletter 
      GROUP BY year, month 
      ORDER BY year DESC, month DESC 
      LIMIT 12
    `;

    // Map bigints to numbers for JSON serialization
    const monthlyGrowth = monthlyGrowthRaw.map(row => ({
      _id: { year: Number(row.year), month: Number(row.month) },
      count: Number(row.count)
    }));

    // Subscription sources
    const sourceStatsRaw = await prisma.newsletter.groupBy({
      by: ['subscriptionSource'],
      _count: { _all: true }
    });

    // Format like Mongo aggregation
    const sourceStats = sourceStatsRaw.map(row => ({
      _id: row.subscriptionSource,
      count: row._count._all
    })).sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      stats: {
        totalSubscribers,
        activeSubscribers,
        unsubscribedCount,
        pendingCount,
        monthlyGrowth,
        sourceStats,
      },
    });
  } catch (error) {
    console.error("Newsletter stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching newsletter statistics",
    });
  }
};

// Get all subscribers (admin endpoint)
exports.getAllNewsletterSubscribers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status || "all";

    let query = {};
    if (status !== "all") {
      query.status = status;
    }

    const totalCount = await prisma.newsletter.count({ where: query });
    const subscribers = await prisma.newsletter.findMany({
      where: query,
      orderBy: { subscribedAt: 'desc' },
      skip: skip,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        subscriptionSource: true,
        ipAddress: true,
        userAgent: true,
        emailVerified: true,
        preferences: true,
        subscribedAt: true,
        unsubscribedAt: true,
        // intentionally omitting verificationToken
      }
    });

    res.json({
      success: true,
      subscribers: subscribers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount: totalCount,
      },
    });
  } catch (error) {
    console.error("Newsletter subscribers error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching subscribers",
    });
  }
};

// Newsletter preferences update endpoint
exports.newsletterPreferences = async (req, res) => {
  try {
    const { email, preferences } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const subscriber = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our newsletter list",
      });
    }

    // Update preferences
    if (preferences) {
      // Prisma Json field update
      const updatedPreferences = typeof subscriber.preferences === 'object' && subscriber.preferences !== null 
          ? { ...subscriber.preferences, ...preferences }
          : preferences;
          
      await prisma.newsletter.update({
        where: { id: subscriber.id },
        data: { preferences: updatedPreferences }
      });
      
      subscriber.preferences = updatedPreferences;
    }

    res.json({
      success: true,
      message: "Your preferences have been updated successfully",
      preferences: subscriber.preferences,
    });
  } catch (error) {
    console.error("Newsletter preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating preferences",
    });
  }
};

module.exports = exports;
