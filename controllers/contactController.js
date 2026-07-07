const prisma = require("../utils/prismaClient");
const { sendWithResendAPI } = require("../utils/emailService");
const { ensureSettings } = require("./settingsController");
const { createNotification } = require("../utils/notificationService");
require("dotenv").config();

// Replace your existing /test/email endpoint with this enhanced version
exports.testEmail = async (req, res) => {
  try {
    const {
      to = "test@example.com",
      subject = "Test Email from Pink Dreams Railway",
    } = req.body;

    const result = await sendTestEmail(to, subject);

    res.json({
      success: true,
      message: "Email sent successfully from Railway using Resend!",
      messageId: result.messageId,
      service: "Resend",
      from: process.env.EMAIL_FROM || "noreply@resend.dev",
      to: to,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Email test failed:", error);
    res.status(500).json({
      success: false,
      message: "Email test failed",
      error: error.message,
      service: process.env.RESEND_API_KEY
        ? "Resend (configured)"
        : "Gmail (fallback - will fail)",
    });
  }
};

// API endpoint to handle contact form submissions
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message, inquiryType } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    // Message length validation
    if (message.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Message must be at least 10 characters long",
      });
    }

    // Create contact record in database
    const contact = await prisma.contact.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        inquiryType: inquiryType || "general",
        ipAddress: req.headers["x-forwarded-for"] || req.connection.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
      }
    });

    // Send emails using Resend HTTP API
    try {
      // Email to admin/business owner
      const adminMailOptions = {
        from: `"Pink Dreams Store" <${process.env.EMAIL_FROM || "noreply@resend.dev"}>`,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || "admin@pink-dreams.com",
        subject: `New Contact Form Submission: ${subject}`,
        html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><h2>New Contact from ${name}</h2><p>${message}</p></body></html>`,
        text: `New Contact from ${name}\n\n${message}`,
      };

      // Auto-reply email to customer
      const customerReplyOptions = {
        from: `"Pink Dreams Store" <${process.env.EMAIL_FROM || "noreply@resend.dev"}>`,
        to: email,
        subject: `Thank you for contacting us - ${subject}`,
        html: `<!DOCTYPE html><html><body><h2>Thank you ${name}</h2><p>We received your message.</p></body></html>`,
        text: `Thank you ${name} for your message.`,
      };

      await sendWithResendAPI(adminMailOptions);
      await sendWithResendAPI(customerReplyOptions);

      // Success response
      res.json({
        success: true,
        message: "Thank you for your message! We will get back to you soon.",
        contactId: contact.id,
        emailStatus: "Both emails sent successfully via Resend API",
      });
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError);
      
      await createNotification({
        type: "contact.new",
        title: "New contact message",
        message: `Message from ${email} - ${subject}`,
        severity: "info",
        actor: { kind: "anonymous", email },
        target: { kind: "contact", id: contact.id, label: subject },
        audience: { permissions: ["contacts:read"] },
      });

      res.json({
        success: true,
        message: "Thank you for your message! We will get back to you soon.",
        contactId: contact.id,
        emailStatus: "Form saved but email notification failed. Please check email configuration.",
        emailError: process.env.NODE_ENV === "development" ? emailError.message : undefined,
      });
    }
  } catch (error) {
    console.error("❌ Contact form submission error:", error);
    res.status(500).json({
      success: false,
      message: "Sorry, there was an error submitting your message. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// API to get all contact submissions (for admin panel)
exports.getAllContactSubmission = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || "all";
    const inquiryType = req.query.inquiryType || "all";

    let query = {};
    if (status !== "all") {
      query.status = status;
    }
    if (inquiryType !== "all") {
      query.inquiryType = inquiryType;
    }

    const totalSubmissions = await prisma.contact.count({ where: query });
    const submissions = await prisma.contact.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    res.json({
      success: true,
      submissions: submissions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSubmissions / limit),
        totalSubmissions: totalSubmissions,
      },
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
};

// API to get contact submission by ID
exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await prisma.contact.findUnique({ where: { id: req.params.id } });

    if (!submission) {
      return res.json({
        success: false,
        message: "Submission not found",
      });
    }

    // Mark as read if it's new
    if (submission.status === "new") {
      const updatedSubmission = await prisma.contact.update({
        where: { id: submission.id },
        data: { status: "read" }
      });
      return res.json({
        success: true,
        submission: updatedSubmission,
      });
    }

    res.json({
      success: true,
      submission: submission,
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
};

// API to update contact submission status
exports.updateContactSubmission = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["new", "read", "replied", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const submission = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!submission) {
      return res.json({
        success: false,
        message: "Submission not found",
      });
    }

    const updatedSubmission = await prisma.contact.update({
      where: { id: submission.id },
      data: {
        status: status,
        repliedAt: status === "replied" ? new Date() : undefined,
      }
    });

    res.json({
      success: true,
      submission: updatedSubmission,
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
};

// API to get contact statistics
exports.getContactStats = async (req, res) => {
  try {
    const totalSubmissions = await prisma.contact.count();
    const newSubmissions = await prisma.contact.count({ where: { status: "new" } });
    const resolvedSubmissions = await prisma.contact.count({ where: { status: "resolved" } });

    const inquiryTypeStatsRaw = await prisma.contact.groupBy({
      by: ['inquiryType'],
      _count: { _all: true }
    });
    const inquiryTypeStats = inquiryTypeStatsRaw.map(r => ({
      _id: r.inquiryType,
      count: r._count._all
    })).sort((a, b) => b.count - a.count);

    const monthlyStatsRaw = await prisma.$queryRaw`
      SELECT YEAR(createdAt) as year, MONTH(createdAt) as month, COUNT(*) as count 
      FROM Contact 
      GROUP BY year, month 
      ORDER BY year DESC, month DESC 
      LIMIT 12
    `;
    const monthlyStats = monthlyStatsRaw.map(row => ({
      _id: { year: Number(row.year), month: Number(row.month) },
      count: Number(row.count)
    }));

    res.json({
      success: true,
      stats: {
        totalSubmissions,
        newSubmissions,
        resolvedSubmissions,
        inquiryTypeStats,
        monthlyStats,
      },
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
};

// API to delete contact submission
exports.deleteContact = async (req, res) => {
  try {
    const submission = await prisma.contact.findUnique({ where: { id: req.params.id } });

    if (!submission) {
      return res.json({
        success: false,
        message: "Submission not found",
      });
    }

    await prisma.contact.delete({ where: { id: req.params.id } });

    res.json({
      success: true,
      message: "Submission deleted successfully",
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = exports;
