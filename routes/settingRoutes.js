// File: routes/admin/settings.js
const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const settingsController = require("../controllers/settingsController");
const { verifyAdminToken } = require("../middleware/authMiddleware");
const uploadMulterTemp = require("../utils/multerTemp");
const {
  verifyStaffUsersToken,
  requirePermission,
} = require("../middleware/rbac-middleware");

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const THEME_COLOR_PATHS = [
  "brand.primary",
  "brand.primaryHover",
  "brand.secondary",
  "brand.accent",
  "brand.gradientFrom",
  "brand.gradientTo",
  "text.heading",
  "text.body",
  "text.muted",
  "text.onPrimary",
  "background.page",
  "background.section",
  "background.card",
  "border.default",
  "buttonPrimary.bg",
  "buttonPrimary.hover",
  "buttonPrimary.text",
  "buttonSecondary.bg",
  "buttonSecondary.hover",
  "buttonSecondary.text",
  "buttonSecondary.border",
  "state.success",
  "state.warning",
  "state.error",
  "state.info",
];

const getValueAtPath = (obj, path) =>
  path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);

const validateThemePayload = (themeSettings) => {
  if (!themeSettings || typeof themeSettings !== "object") return true;

  for (const path of THEME_COLOR_PATHS) {
    const value = getValueAtPath(themeSettings, path);
    if (value === undefined || value === null || value === "") continue;

    if (typeof value !== "string" || !HEX_COLOR_REGEX.test(value.trim())) {
      throw new Error(
        `Invalid color at themeSettings.${path}. Use hex format like #ec4899`,
      );
    }
  }

  return true;
};

// GET admin settings (protected)
router.get(
  "/admin/settings",
  verifyStaffUsersToken,
  requirePermission("settings:read"),
  settingsController.getAdminSettings,
);

// GET public settings (unprotected)
router.get("/settings/public", settingsController.getPublicSettings);

// PUT admin settings (protected)
router.put(
  "/admin/settings",
  verifyStaffUsersToken,
  requirePermission("settings:update"),
  // minimal validation
  body("generalSettings.seo.siteTitle")
    .optional()
    .isString()
    .isLength({ min: 3, max: 60 }),
  body("generalSettings.seo.siteDescription")
    .optional()
    .isString()
    .isLength({ max: 160 }),
  body("contact.email")
    .optional()
    .custom((value) => {
      if (value === "") return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
    }),
  body("contact.phone").optional().isString().isLength({ max: 60 }),
  body("contact.address").optional().isString().isLength({ max: 300 }),
  body("themeSettings").optional().custom(validateThemePayload),
  body("email.from").optional().isEmail(),
  body("email.admin").optional().isEmail(),
  settingsController.updateSettings,
);

// POST upload image (protected) - query param ?type=favicon|siteLogo|adminLogo
router.post(
  "/admin/settings/upload",
  verifyStaffUsersToken,
  requirePermission("settings:update"),
  uploadMulterTemp.single("file"),
  settingsController.uploadImage,
);

// POST test email
router.post(
  "/admin/settings/test-email",
  verifyAdminToken,
  settingsController.sendTestEmail,
);

//Delete all the settings
router.delete(
  "/admin/settings/delete",
  verifyStaffUsersToken,
  requirePermission("settings:delete"),
  settingsController.deleteSettings,
);

//Test payment connection
router.post(
  "/admin/settings/test-payment/:provider",
  verifyStaffUsersToken,
  requirePermission("settings:update"),
  settingsController.testPaymentConnection,
);

module.exports = router;
