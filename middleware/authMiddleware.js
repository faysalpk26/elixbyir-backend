const jwt = require('jsonwebtoken');
const { getTokenFromRequest } = require("../utils/tokenExtractor");
const { STAFF_AUTH_COOKIE_NAME } = require("../utils/staffAuthCookie");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const USER_AUTH_COOKIE_NAME =
  process.env.USER_AUTH_COOKIE_NAME || "user_access_token";

// Middleware to verify JWT token
const fetchUser = (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            errors: "Please authenticate using valid token" 
        });
    }
    try {
        const data = jwt.verify(token, JWT_SECRET);
        req.user = data.user;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            errors: "Please authenticate using valid token" 
        });
    }
};

const verifyToken = (req, res, next) => {
  const token = getTokenFromRequest(req, USER_AUTH_COOKIE_NAME);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
    const token = getTokenFromRequest(req, STAFF_AUTH_COOKIE_NAME);
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if it's an admin token
        if (decoded.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }
        
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

module.exports = { fetchUser, verifyToken , verifyAdminToken };
