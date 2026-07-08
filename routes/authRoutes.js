const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

const {
  loginLimiter,
  loginSlowDown,
  registrationLimiter,
  passwordResetLimiter,
} = require('../config/rateLimiter');

const {
  register,
  login,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  checkEmail,
  logout,
} = require('../controllers/authController');

// ─── JWT Middleware ───────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: 'Access denied. No token provided.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(400).json({ success: false, message: 'Invalid token.' });
  }
};

// ─── Email / Password Auth ────────────────────────────────────────────────────
router.post('/auth/register', registrationLimiter, register);
router.post('/auth/login', loginLimiter, loginSlowDown, login);
router.post('/auth/logout', verifyToken, logout);
router.post('/auth/forgot-password', passwordResetLimiter, forgotPassword);
router.get('/auth/verify-reset-token/:token', verifyResetToken);
router.post('/auth/reset-password', resetPassword);
router.post('/auth/check-email', checkEmail);

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get('/auth/profile', verifyToken, getProfile);
router.put('/auth/profile', verifyToken, updateProfile);
router.post('/auth/change-password', verifyToken, changePassword);

// ─── Google OAuth ─────────────────────────────────────────────────────────────
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?error=google_auth_failed`,
    session: false,
  }),
  (req, res) => {
    try {
      const token = jwt.sign(
        { id: req.user.id, email: req.user.email, role: req.user.role },
        JWT_SECRET,
        { expiresIn: '7d' },
      );
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=google&success=true`);
    } catch (err) {
      console.error('❌ Google OAuth callback error:', err);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=google_callback_failed`);
    }
  },
);

// ─── Facebook OAuth ───────────────────────────────────────────────────────────
router.get(
  '/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] }),
);

router.get(
  '/auth/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?error=facebook_auth_failed`,
    session: false,
  }),
  (req, res) => {
    try {
      const token = jwt.sign(
        { id: req.user.id, email: req.user.email, role: req.user.role },
        JWT_SECRET,
        { expiresIn: '7d' },
      );
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=facebook&success=true`);
    } catch (err) {
      console.error('❌ Facebook OAuth callback error:', err);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=facebook_callback_failed`);
    }
  },
);

module.exports = router;
