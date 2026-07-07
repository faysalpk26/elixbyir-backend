const express = require("express");
const router = express.Router();
const Contact = require("../models/contactModel");
const {
  testEmail,
  submitContactForm,
  getAllContactSubmission,
  getSubmissionById,
  updateContactSubmission,
  getContactStats,
  deleteContact,
} = require("../controllers/contactController");
const { verifyStaffUsersToken, requirePermission } = require("../middleware/rbac-middleware");

// Replace your existing /test/email endpoint with this enhanced version
router.post(
  "/test/email",
  verifyStaffUsersToken,
  requirePermission("contacts:read"),
  testEmail,
);

// Middleware to get client IP
const getClientIP = (req) => {
  return (
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  );
};

// API endpoint to handle contact form submissions
router.post("/contact/submit", submitContactForm);

// API to get all contact submissions (for admin panel)
router.get("/contact/submissions",  verifyStaffUsersToken, requirePermission('contacts:read'), getAllContactSubmission);

// API to get contact submission by ID
router.get(
  "/contact/submission/:id",
  verifyStaffUsersToken,
  requirePermission("contacts:read"),
  getSubmissionById,
);

// API to update contact submission status
router.patch("/contact/submission/:id/status", verifyStaffUsersToken, requirePermission('contacts:update'), updateContactSubmission);

// API to get contact statistics
router.get("/contact/stats", verifyStaffUsersToken, requirePermission('contacts:read'), getContactStats);

// API to delete contact submission
router.delete("/contact/submission/:id",verifyStaffUsersToken, requirePermission('contacts:delete'), deleteContact);


module.exports = router;
