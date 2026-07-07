const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const { loginLimiter, loginSlowDown, authLimiter, registrationLimiter, passwordResetLimiter } = require('../config/rateLimiter');
const { register, login, forgotPassword, getProfile, updateProfile, changePassword, checkEmail } = require('../controllers/authController');

const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ success: false, message: 'Invalid token.' });
    }
};

router.post('/auth/register', 
    registrationLimiter,   // Apply registration rate limiting
    register
);

// REPLACE your existing Login endpoint
router.post('/auth/login', 
    loginLimiter,      // Apply login-specific rate limiting
    loginSlowDown,     // Apply progressive delay
    login
);

// FIXED: Forgot Password - Send Reset Email
router.post('/auth/forgot-password', 
    passwordResetLimiter,  // Apply password reset rate limiting
    forgotPassword
);

// Verify Reset Token
router.get("/auth/verify-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
        expired: true,
      });
    }

    res.json({
      success: true,
      message: "Reset token is valid",
      user: {
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Verify reset token error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Reset Password
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validation
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (newPassword.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Password must not exceed 100 characters",
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
        expired: true,
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Send confirmation email
    try {
      const transporter = createTransport();

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Password Reset Successful - Pink Dreams",
        html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h2 style="margin: 0;">Password Reset Successful</h2>
                            </div>
                            
                            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                                <p>Hi ${user.name},</p>
                                <p>Your password has been successfully reset for your Pink Dreams account.</p>
                                <p>If you didn't make this change, please contact our support team immediately.</p>
                                <p>For security, we recommend:</p>
                                <ul>
                                    <li>Using a unique password for your account</li>
                                    <li>Enabling two-factor authentication if available</li>
                                    <li>Not sharing your password with anyone</li>
                                </ul>
                                <p>Best regards,<br>The Pink Dreams Team</p>
                                
                                <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #6b7280;">
                                    <p>Reset completed on: ${new Date().toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    `,
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
      // Don't fail the request if confirmation email fails
    }

    res.json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again.",
    });
  }
});

// Add a test endpoint to verify rate limiting is working
router.get('/auth/rate-limit-status', (req, res) => {
    if (process.env.NODE_ENV === "production") {
        return res.status(404).json({
            success: false,
            message: "Not found",
        });
    }

    res.json({
        success: true,
        message: 'Rate limiting is active',
        ip: req.ip,
        rateLimits: {
            login: '5 attempts per 15 minutes',
            registration: '3 attempts per hour', 
            passwordReset: '3 attempts per hour'
        },
        testInstructions: {
            login: 'Try logging in with wrong credentials 6 times to test login rate limiting',
            registration: 'Try registering 4 times in an hour to test registration rate limiting'
        }
    });
});
// Get current user profile
router.get('/auth/profile', verifyToken,getProfile);

// Update user profile
router.put('/auth/profile', verifyToken, updateProfile);

// Change password
router.post('/auth/change-password', verifyToken, changePassword);

// Logout endpoint (optional - mainly for token blacklisting if implemented)
router.post('/auth/logout', verifyToken, async (req, res) => {
    try {
        // In a real implementation, you might want to blacklist the token
        // For now, we'll just send a success response
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
// Add this endpoint to your existing index.js file

// Check if email exists (for real-time validation during registration)
router.post('/auth/check-email', checkEmail);

// Google OAuth routes
router.get( "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

router.get( "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login?error=google_auth_failed",
  }),
  async (req, res) => {
    try {
      undefined;

      // Generate JWT token for the user
      const token = jwt.sign(
        {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(
        `${frontendUrl}/auth/callback?token=${token}&provider=google&success=true`,
      );
    } catch (error) {
      console.error("❌ Google OAuth callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/callback?error=google_callback_failed`);
    }
  },
);

// Facebook OAuth routes
router.get( "/auth/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
  }),
);

router.get( "/auth/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: "/login?error=facebook_auth_failed",
  }),
  async (req, res) => {
    try {
      undefined;

      // Generate JWT token for the user
      const token = jwt.sign(
        {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(
        `${frontendUrl}/auth/callback?token=${token}&provider=facebook&success=true`,
      );
    } catch (error) {
      console.error("❌ Facebook OAuth callback error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(
        `${frontendUrl}/auth/callback?error=facebook_callback_failed`,
      );
    }
  },
);

// OAuth logout route
router.post("/auth/oauth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error logging out",
      });
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error destroying session",
        });
      }

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  });
});

// Check OAuth link status
router.get("/auth/oauth/status", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "googleId facebookId authProvider",
    );

    res.json({
      success: true,
      oauth: {
        hasGoogle: !!user.googleId,
        hasFacebook: !!user.facebookId,
        authProvider: user.authProvider,
        canUnlink: user.authProvider === "local", // Only allow unlinking if user has local auth
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking OAuth status",
    });
  }
});

// Link OAuth account to existing user
router.post("/auth/oauth/link/:provider", verifyToken, async (req, res) => {
  try {
    const { provider } = req.params;

    if (!["google", "facebook"].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OAuth provider",
      });
    }

    // Store user ID in session for linking
    req.session.linkUserId = req.user.id;

    // Redirect to OAuth provider
    const authUrl = `/auth/${provider}?link=true`;
    res.json({
      success: true,
      redirectUrl: authUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error initiating OAuth link",
    });
  }
});

// Unlink OAuth account
router.delete("/auth/oauth/unlink/:provider", verifyToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Don't allow unlinking if it's the only auth method
    if (user.authProvider === provider && !user.password) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot unlink the only authentication method. Please set a password first.",
      });
    }

    // Remove OAuth ID
    if (provider === "google") {
      user.googleId = undefined;
    } else if (provider === "facebook") {
      user.facebookId = undefined;
    }

    await user.save();

    res.json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error unlinking OAuth account",
    });
  }
});


module.exports = router;
