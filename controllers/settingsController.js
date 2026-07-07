// File: controllers/settingsController.js
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { delKey, getJSON, setJSON } = require("../utils/redisClient");
const { createNotification } = require("../utils/notificationService");
const prisma = require("../utils/prismaClient");
const {
  encryptSecret,
  decryptSecret,
  maskSecret,
} = require("../utils/cryptoSecrets");

const PUBLIC_SETTINGS_KEY = "public:settings";
const TTL_SECONDS = 300; // 5 minutes
const DEFAULT_CONTACT_EMAIL = "hello@pinkdreams.com";
const DEFAULT_CONTACT_PHONE = "+1 (555) 123-4567";
const DEFAULT_CONTACT_ADDRESS =
  "123 Fashion Avenue, Suite 456, New York, NY 10001, United States";
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_THEME_SETTINGS = {
  brand: {
    primary: "#ec4899",
    primaryHover: "#db2777",
    secondary: "#f43f5e",
    accent: "#be185d",
    gradientFrom: "#ec4899",
    gradientTo: "#f43f5e",
  },
  text: {
    heading: "#111827",
    body: "#374151",
    muted: "#6b7280",
    onPrimary: "#ffffff",
  },
  background: {
    page: "#fff7fb",
    section: "#ffffff",
    card: "#ffffff",
  },
  border: {
    default: "#e5e7eb",
  },
  buttonPrimary: {
    bg: "#ec4899",
    hover: "#db2777",
    text: "#ffffff",
  },
  buttonSecondary: {
    bg: "#ffffff",
    hover: "#fdf2f8",
    text: "#be185d",
    border: "#f9a8d4",
  },
  state: {
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
  },
};

const cloneDefaultThemeSettings = () =>
  JSON.parse(JSON.stringify(DEFAULT_THEME_SETTINGS));

const normalizeHexColor = (value, fallback) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  const prefixed = raw.startsWith("#") ? raw : `#${raw}`;
  if (!HEX_COLOR_REGEX.test(prefixed)) return fallback;
  return prefixed.toLowerCase();
};

const mergeThemeSettings = (baseTheme, incomingTheme = {}) => {
  const mergedTheme = {};
  const source =
    incomingTheme && typeof incomingTheme === "object" ? incomingTheme : {};

  Object.keys(baseTheme || {}).forEach((groupKey) => {
    const baseGroup = baseTheme[groupKey] || {};
    const incomingGroup =
      source[groupKey] && typeof source[groupKey] === "object"
        ? source[groupKey]
        : {};

    mergedTheme[groupKey] = {};
    Object.keys(baseGroup).forEach((tokenKey) => {
      mergedTheme[groupKey][tokenKey] = normalizeHexColor(
        incomingGroup[tokenKey],
        baseGroup[tokenKey],
      );
    });
  });

  return mergedTheme;
};

function addressObjectToString(addressObj) {
  if (!addressObj || typeof addressObj !== "object") return "";

  return [
    addressObj.line1,
    addressObj.line2,
    addressObj.city,
    addressObj.state,
    addressObj.zip,
    addressObj.country,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function getLegacyPrimaryEmail(legacyContact = {}) {
  if (typeof legacyContact.email === "string" && legacyContact.email.trim()) {
    return legacyContact.email.trim();
  }

  if (Array.isArray(legacyContact.emails)) {
    const firstEmail = legacyContact.emails.find((item) =>
      item?.email?.trim(),
    );
    return firstEmail?.email?.trim() || "";
  }

  return "";
}

function getLegacyPrimaryPhone(legacyContact = {}) {
  if (typeof legacyContact.phone === "string" && legacyContact.phone.trim()) {
    return legacyContact.phone.trim();
  }

  if (Array.isArray(legacyContact.phones)) {
    const firstPhone = legacyContact.phones.find((item) =>
      item?.number?.trim(),
    );
    return firstPhone?.number?.trim() || "";
  }

  return "";
}

function getLegacyAddress(legacyContact = {}) {
  if (typeof legacyContact.address === "string" && legacyContact.address.trim()) {
    return legacyContact.address.trim();
  }

  if (legacyContact.address && typeof legacyContact.address === "object") {
    const formatted = addressObjectToString(legacyContact.address);
    if (formatted) return formatted;
  }

  if (Array.isArray(legacyContact.addresses)) {
    const firstAddress = legacyContact.addresses.find(Boolean);
    if (typeof firstAddress === "string" && firstAddress.trim()) {
      return firstAddress.trim();
    }

    if (firstAddress && typeof firstAddress === "object") {
      return addressObjectToString(firstAddress);
    }
  }

  return "";
}

function setEncryptedField(currentValue, incomingValue) {
  // undefined or empty string means "do not change"
  if (incomingValue === undefined || incomingValue === "")
    return currentValue || "";
  // null means explicit clear
  if (incomingValue === null) return "";
  return encryptSecret(incomingValue);
}

function sanitizeAdminSettings(settings) {
  const settingsCopy = JSON.parse(JSON.stringify(settings));

  const paymentSettings = settingsCopy.paymentSettings || {};
  const stripeCreds = paymentSettings?.credentials?.stripe || {};
  const paypalCreds = paymentSettings?.credentials?.paypal || {};

  const stripeSecret = decryptSecret(stripeCreds.secretKey);
  const stripeWebhook = decryptSecret(stripeCreds.webhookSecret);
  const paypalSecret = decryptSecret(paypalCreds.clientSecret);

  settingsCopy.paymentSettings = paymentSettings;
  settingsCopy.paymentSettings.credentials = {
    stripe: {
      publishableKey: stripeCreds.publishableKey || "",
      secretKey: "",
      webhookSecret: "",
    },
    paypal: {
      clientId: paypalCreds.clientId || "",
      clientSecret: "",
    },
  };

  settingsCopy.paymentSettings.credentialsMeta = {
    stripe: {
      secretKeySet: !!stripeCreds.secretKey,
      webhookSecretSet: !!stripeCreds.webhookSecret,
      secretKeyPreview: maskSecret(stripeSecret),
      webhookSecretPreview: maskSecret(stripeWebhook),
    },
    paypal: {
      clientSecretSet: !!paypalCreds.clientSecret,
      clientSecretPreview: maskSecret(paypalSecret),
    },
  };

  settingsCopy.themeSettings = mergeThemeSettings(
    cloneDefaultThemeSettings(),
    settingsCopy.themeSettings || {},
  );

  return settingsCopy;
}

const DEFAULT_SETTINGS = {
  generalSettings: { seo: { siteTitle: "", siteDescription: "" }, branding: { siteLogo: null, adminLogo: null, favicon: null } },
  contact: { email: "", phone: "", address: "", social: { facebook: "", instagram: "", twitter: "", pinterest: "" }, hours: "" },
  email: { from: "", admin: "" },
  paymentSettings: { methods: { stripe: { enabled: true }, paypal: { enabled: true }, cod: { enabled: false }, bankTransfer: { enabled: false, instructions: "" } }, credentials: { stripe: { publishableKey: "", secretKey: "", webhookSecret: "" }, paypal: { clientId: "", clientSecret: "" } } },
  allowGuestCheckout: true
};

async function ensureSettings() {
  try {
    const existing = await prisma.settings.findFirst();
    if (existing) {
      let changed = false;
      const contactObj = (typeof existing.contact === 'string' ? JSON.parse(existing.contact) : existing.contact) || {};
      const themeObj = (typeof existing.themeSettings === 'string' ? JSON.parse(existing.themeSettings) : existing.themeSettings) || {};
      
      const shouldMigrateEmail = contactObj.email == null || contactObj.email === DEFAULT_CONTACT_EMAIL;
      if (shouldMigrateEmail) {
        const legacyEmail = getLegacyPrimaryEmail(contactObj);
        if (legacyEmail) {
          contactObj.email = legacyEmail;
          changed = true;
        }
      }

      const shouldMigratePhone = contactObj.phone == null || contactObj.phone === DEFAULT_CONTACT_PHONE;
      if (shouldMigratePhone) {
        const legacyPhone = getLegacyPrimaryPhone(contactObj);
        if (legacyPhone) {
          contactObj.phone = legacyPhone;
          changed = true;
        }
      }

      const shouldMigrateAddress = contactObj.address == null || contactObj.address === DEFAULT_CONTACT_ADDRESS;
      if (shouldMigrateAddress) {
        const legacyAddress = getLegacyAddress(contactObj);
        if (legacyAddress) {
          contactObj.address = legacyAddress;
          changed = true;
        }
      }

      const normalizedThemeSettings = mergeThemeSettings(
        cloneDefaultThemeSettings(),
        themeObj,
      );
      if (JSON.stringify(themeObj || {}) !== JSON.stringify(normalizedThemeSettings)) {
        changed = true;
      }

      if (changed) {
        const updated = await prisma.settings.update({
          where: { id: existing.id },
          data: {
            contact: contactObj,
            themeSettings: normalizedThemeSettings
          }
        });
        return {
          ...updated,
          generalSettings: typeof updated.generalSettings === 'string' ? JSON.parse(updated.generalSettings) : updated.generalSettings,
          contact: typeof updated.contact === 'string' ? JSON.parse(updated.contact) : updated.contact,
          email: typeof updated.email === 'string' ? JSON.parse(updated.email) : updated.email,
          themeSettings: typeof updated.themeSettings === 'string' ? JSON.parse(updated.themeSettings) : updated.themeSettings,
          paymentSettings: typeof updated.paymentSettings === 'string' ? JSON.parse(updated.paymentSettings) : updated.paymentSettings,
        };
      }

      return {
        ...existing,
        generalSettings: typeof existing.generalSettings === 'string' ? JSON.parse(existing.generalSettings) : existing.generalSettings,
        contact: typeof existing.contact === 'string' ? JSON.parse(existing.contact) : existing.contact,
        email: typeof existing.email === 'string' ? JSON.parse(existing.email) : existing.email,
        themeSettings: typeof existing.themeSettings === 'string' ? JSON.parse(existing.themeSettings) : existing.themeSettings,
        paymentSettings: typeof existing.paymentSettings === 'string' ? JSON.parse(existing.paymentSettings) : existing.paymentSettings,
      };
    }
    
    // Create a new document using schema defaults
    const created = await prisma.settings.create({
      data: {
        generalSettings: DEFAULT_SETTINGS.generalSettings,
        contact: DEFAULT_SETTINGS.contact,
        email: DEFAULT_SETTINGS.email,
        paymentSettings: DEFAULT_SETTINGS.paymentSettings,
        allowGuestCheckout: DEFAULT_SETTINGS.allowGuestCheckout
      }
    });
    
    return {
      ...created,
      generalSettings: typeof created.generalSettings === 'string' ? JSON.parse(created.generalSettings) : created.generalSettings,
      contact: typeof created.contact === 'string' ? JSON.parse(created.contact) : created.contact,
      email: typeof created.email === 'string' ? JSON.parse(created.email) : created.email,
      themeSettings: typeof created.themeSettings === 'string' ? JSON.parse(created.themeSettings) : created.themeSettings,
      paymentSettings: typeof created.paymentSettings === 'string' ? JSON.parse(created.paymentSettings) : created.paymentSettings,
    };
  } catch (err) {
    console.error("[settings] ensureSettings error:", err);
    throw err;
  }
}

// Admin: get complete settings (except secrets)
const getAdminSettings = async (req, res) => {
  try {
    const settings = await ensureSettings();
    return res.json({
      success: true,
      settings: sanitizeAdminSettings(settings),
    });
  } catch (err) {
    console.error("getAdminSettings error", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Public: return only public-facing fields
const getPublicSettings = async (req, res) => {
  try {
    // Try cache
    const cached = await getJSON(PUBLIC_SETTINGS_KEY);
    if (cached) {
      return res.json({ success: true, settings: cached, cached: true });
    }
    
    const settings = await ensureSettings();

    const dbStripePk =
      settings.paymentSettings?.credentials?.stripe?.publishableKey?.trim() ||
      "";
    const dbStripeSk =
      decryptSecret(
        settings.paymentSettings?.credentials?.stripe?.secretKey,
      )?.trim() || "";

    const hasAnyDbStripe = !!(dbStripePk || dbStripeSk);
    const stripePk = hasAnyDbStripe
      ? dbStripePk
      : (process.env.STRIPE_PUBLISHABLE_KEY || "").trim();

    const stripeEnabled =
      (settings.paymentSettings?.methods?.stripe?.enabled ?? true) &&
      !!stripePk;

    const paypalClientId =
      settings.paymentSettings?.credentials?.paypal?.clientId ||
      process.env.PAYPAL_CLIENT_ID ||
      "";
    const paypalEnabled =
      (settings.paymentSettings?.methods?.paypal?.enabled ?? true) &&
      !!paypalClientId;
    const themeSettings = mergeThemeSettings(
      cloneDefaultThemeSettings(),
      settings.themeSettings || {},
    );

    const publicData = {
      siteTitle: settings.generalSettings?.seo?.siteTitle,
      siteDescription: settings.generalSettings?.seo?.siteDescription,
      branding: settings.generalSettings?.branding,
      themeSettings,
      contact: {
        email: settings.contact?.email,
        phone: settings.contact?.phone,
        address: settings.contact?.address,
        social: settings.contact?.social,
        hours: settings.contact?.hours,
      },
      allowGuestCheckout: settings.allowGuestCheckout ?? true,
      paymentSettings: {
        methods: {
          stripe: { enabled: stripeEnabled },
          paypal: { enabled: paypalEnabled },
          cod: {
            enabled: settings.paymentSettings?.methods?.cod?.enabled ?? false,
          },
          bankTransfer: {
            enabled:
              settings.paymentSettings?.methods?.bankTransfer?.enabled ?? false,
            instructions:
              settings.paymentSettings?.methods?.bankTransfer?.instructions ||
              "",
          },
        },
        credentialsPublic: {
          stripe: { publishableKey: stripePk },
          paypal: { clientId: paypalClientId },
        },
      },
    };

    // Store in Redis
    await setJSON(PUBLIC_SETTINGS_KEY, publicData, TTL_SECONDS);
    return res.json({ success: true, settings: publicData });
  } catch (err) {
    console.error("getPublicSettings error", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update settings (admin only)
const updateSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Merge approach
    const settings = await ensureSettings();

    // Deep copy to mutate easily before saving back to Prisma
    let newGeneralSettings = JSON.parse(JSON.stringify(settings.generalSettings || {}));
    let newContact = JSON.parse(JSON.stringify(settings.contact || {}));
    let newEmail = JSON.parse(JSON.stringify(settings.email || {}));
    let newPaymentSettings = JSON.parse(JSON.stringify(settings.paymentSettings || {}));
    let newAllowGuestCheckout = settings.allowGuestCheckout;
    let newThemeSettings = settings.themeSettings;

    // Merge SEO
    if (req.body.generalSettings && req.body.generalSettings.seo) {
      newGeneralSettings.seo = newGeneralSettings.seo || {};
      newGeneralSettings.seo.siteTitle =
        req.body.generalSettings.seo.siteTitle ||
        newGeneralSettings.seo.siteTitle;
      newGeneralSettings.seo.siteDescription =
        req.body.generalSettings.seo.siteDescription ||
        newGeneralSettings.seo.siteDescription;
    }

    // Merge contact
    if (req.body.contact) {
      const incomingContact = req.body.contact;

      if (typeof incomingContact.email === "string") {
        newContact.email = incomingContact.email.trim();
      } else if (Array.isArray(incomingContact.emails)) {
        newContact.email = getLegacyPrimaryEmail(incomingContact);
      }

      if (typeof incomingContact.phone === "string") {
        newContact.phone = incomingContact.phone.trim();
      } else if (Array.isArray(incomingContact.phones)) {
        newContact.phone = getLegacyPrimaryPhone(incomingContact);
      }

      if (typeof incomingContact.address === "string") {
        newContact.address = incomingContact.address.trim();
      } else if (
        incomingContact.address &&
        typeof incomingContact.address === "object"
      ) {
        newContact.address = addressObjectToString(incomingContact.address);
      } else if (Array.isArray(incomingContact.addresses)) {
        newContact.address = getLegacyAddress(incomingContact);
      }

      if (incomingContact.social) {
        newContact.social = Object.assign(
          {},
          newContact.social,
          incomingContact.social,
        );
      }
      if (incomingContact.hours) {
        newContact.hours = Object.assign(
          {},
          newContact.hours,
          incomingContact.hours,
        );
      }
    }

    // Merge email
    if (req.body.email) {
      if (req.body.email.from !== undefined)
        newEmail.from = req.body.email.from;
      if (req.body.email.admin !== undefined)
        newEmail.admin = req.body.email.admin;
    }

    if (typeof req.body.allowGuestCheckout === "boolean") {
      newAllowGuestCheckout = req.body.allowGuestCheckout;
    }

    if (req.body.themeSettings && typeof req.body.themeSettings === "object") {
      const currentThemeSettings = mergeThemeSettings(
        cloneDefaultThemeSettings(),
        settings.themeSettings || {},
      );
      newThemeSettings = mergeThemeSettings(
        currentThemeSettings,
        req.body.themeSettings,
      );
    }

    // Merge branding images only expect { siteLogo: { public_id, url, alt } }
    if (req.body.generalSettings && req.body.generalSettings.branding) {
      const b = req.body.generalSettings.branding;
      newGeneralSettings.branding = newGeneralSettings.branding || {};
      if (b.siteLogo)
        newGeneralSettings.branding.siteLogo = Object.assign(
          {},
          newGeneralSettings.branding.siteLogo || {},
          b.siteLogo,
        );
      if (b.adminLogo)
        newGeneralSettings.branding.adminLogo = Object.assign(
          {},
          newGeneralSettings.branding.adminLogo || {},
          b.adminLogo,
        );
      if (b.favicon)
        newGeneralSettings.branding.favicon = Object.assign(
          {},
          newGeneralSettings.branding.favicon || {},
          b.favicon,
        );
    }

    if (req.body.paymentSettings) {
      const incoming = req.body.paymentSettings;
      newPaymentSettings.methods = newPaymentSettings.methods || {};
      newPaymentSettings.credentials = newPaymentSettings.credentials || {};

      // methods
      if (incoming.methods) {
        newPaymentSettings.methods.stripe = newPaymentSettings.methods.stripe || {};
        newPaymentSettings.methods.paypal = newPaymentSettings.methods.paypal || {};
        newPaymentSettings.methods.cod = newPaymentSettings.methods.cod || {};
        newPaymentSettings.methods.bankTransfer = newPaymentSettings.methods.bankTransfer || {};

        if (
          incoming.methods.stripe &&
          typeof incoming.methods.stripe.enabled === "boolean"
        ) {
          newPaymentSettings.methods.stripe.enabled =
            incoming.methods.stripe.enabled;
        }
        if (
          incoming.methods.paypal &&
          typeof incoming.methods.paypal.enabled === "boolean"
        ) {
          newPaymentSettings.methods.paypal.enabled =
            incoming.methods.paypal.enabled;
        }
        if (
          incoming.methods.cod &&
          typeof incoming.methods.cod.enabled === "boolean"
        ) {
          newPaymentSettings.methods.cod.enabled =
            incoming.methods.cod.enabled;
        }
        if (incoming.methods.bankTransfer) {
          if (typeof incoming.methods.bankTransfer.enabled === "boolean") {
            newPaymentSettings.methods.bankTransfer.enabled =
              incoming.methods.bankTransfer.enabled;
          }
          if (typeof incoming.methods.bankTransfer.instructions === "string") {
            newPaymentSettings.methods.bankTransfer.instructions =
              incoming.methods.bankTransfer.instructions;
          }
        }
      }

      // credentials
      if (incoming.credentials) {
        newPaymentSettings.credentials.stripe = newPaymentSettings.credentials.stripe || {};
        newPaymentSettings.credentials.paypal = newPaymentSettings.credentials.paypal || {};

        if (incoming.credentials.stripe) {
          if (typeof incoming.credentials.stripe.publishableKey === "string") {
            newPaymentSettings.credentials.stripe.publishableKey =
              incoming.credentials.stripe.publishableKey;
          }

          newPaymentSettings.credentials.stripe.secretKey =
            setEncryptedField(
              newPaymentSettings.credentials.stripe.secretKey,
              incoming.credentials.stripe.secretKey,
            );

          newPaymentSettings.credentials.stripe.webhookSecret =
            setEncryptedField(
              newPaymentSettings.credentials.stripe.webhookSecret,
              incoming.credentials.stripe.webhookSecret,
            );
        }

        if (incoming.credentials.paypal) {
          if (typeof incoming.credentials.paypal.clientId === "string") {
            newPaymentSettings.credentials.paypal.clientId =
              incoming.credentials.paypal.clientId;
          }

          newPaymentSettings.credentials.paypal.clientSecret =
            setEncryptedField(
              newPaymentSettings.credentials.paypal.clientSecret,
              incoming.credentials.paypal.clientSecret,
            );
        }
      }
    }

    const updatedSettings = await prisma.settings.update({
      where: { id: settings.id },
      data: {
        generalSettings: newGeneralSettings,
        contact: newContact,
        email: newEmail,
        themeSettings: newThemeSettings,
        paymentSettings: newPaymentSettings,
        allowGuestCheckout: newAllowGuestCheckout
      }
    });
    
    const formattedSettings = {
      ...updatedSettings,
      generalSettings: typeof updatedSettings.generalSettings === 'string' ? JSON.parse(updatedSettings.generalSettings) : updatedSettings.generalSettings,
      contact: typeof updatedSettings.contact === 'string' ? JSON.parse(updatedSettings.contact) : updatedSettings.contact,
      email: typeof updatedSettings.email === 'string' ? JSON.parse(updatedSettings.email) : updatedSettings.email,
      themeSettings: typeof updatedSettings.themeSettings === 'string' ? JSON.parse(updatedSettings.themeSettings) : updatedSettings.themeSettings,
      paymentSettings: typeof updatedSettings.paymentSettings === 'string' ? JSON.parse(updatedSettings.paymentSettings) : updatedSettings.paymentSettings,
    };

    await delKey(`public:settings`);

    await createNotification({
      type: "settings.updated",
      title: "Settings updated",
      message: "Store settings updated",
      severity: "high",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "settings", id: "global", label: "Settings" },
      audience: { permissions: ["settings:read"] },
    });

    return res.json({ success: true, settings: formattedSettings });
  } catch (err) {
    console.error("updateSettings error", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Upload endpoint: accepts a single file via multer on the route and uploads to Cloudinary
const uploadImage = async (req, res) => {
  try {
    // Ensure a file was provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    // Basic mime validation: allow common image types. For favicons admin should upload PNG or ICO.
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];

    if (!allowed.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid image type" });
    }

    let uploadedUrl = "";
    let cloudinaryResult = null;

    if (req.file) {
      // Reuse your existing helper that uploads a file buffer to Cloudinary
      // uploadToCloudinary should return an object with at least `url` or `secure_url` and `public_id`.
      cloudinaryResult = await uploadToCloudinary(req.file);
      uploadedUrl = cloudinaryResult?.url || cloudinaryResult?.secure_url || "";
    }

    if (!uploadedUrl) {
      return res
        .status(500)
        .json({ success: false, message: "Error while uploading image" });
    }

    return res.json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: uploadedUrl,
      filename: req.file.filename || req.file.originalname || null,
      public_id: cloudinaryResult?.public_id || null,
    });
  } catch (err) {
    console.error("image upload error", err);
    return res.status(500).json({
      success: false,
      message: "Image upload failed",
      error: err.message,
    });
  }
};

// Send test email using SMTP from env but from/replyTo from DB (or fallback)
const sendTestEmail = async (req, res) => {
  try {
    const settings = await ensureSettings();

    const fromAddress =
      settings.email && settings.email.from
        ? settings.email.from
        : process.env.EMAIL_FROM;
    const adminAddress =
      settings.email && settings.email.admin
        ? settings.email.admin
        : process.env.EMAIL_ADMIN;

    if (!fromAddress)
      return res
        .status(400)
        .json({ success: false, message: "From address not configured" });

    // configure nodemailer using env SMTP (we said provider secrets are env-only)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: adminAddress || fromAddress,
      subject: "Test email from Pink Dreams settings",
      text: "This is a test email to verify settings.",
      html: "<p>This is a <strong>test</strong> email to verify settings.</p>",
    });

    return res.json({ success: true, info });
  } catch (err) {
    console.error("sendTestEmail error", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

//delete settings
const deleteSettings = async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst();

    if (!settings) {
      return res.json({ status: false, message: "Settings not found " });
    }

    const deleteSetting = await prisma.settings.deleteMany({});
    await delKey(`public:settings`);
    
    await createNotification({
      type: "settings.deleted",
      title: "Settings deleted",
      message: "Settings document deleted",
      severity: "critical",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "settings", id: "global", label: "Settings" },
      audience: { permissions: ["settings:read"] },
    });

    res.json({
      status: true,
      message: "settings deleted successfully",
      settings: deleteSetting,
    });
  } catch (error) {
    res.json({
      status: false,
      message: "Error while deleting settings",
      err: error.message,
    });
  }
};

//Test payment connection
const testPaymentConnection = async (req, res) => {
  try {
    const provider = String(req.params.provider || "").toLowerCase();
    const settings = await ensureSettings();

    if (provider === "stripe") {
      const enabled = settings.paymentSettings?.methods?.stripe?.enabled;
      if (!enabled) {
        return res
          .status(400)
          .json({ success: false, message: "Stripe is disabled" });
      }

      const secret =
        decryptSecret(
          settings.paymentSettings?.credentials?.stripe?.secretKey,
        ) || process.env.STRIPE_SECRET_KEY;

      if (!secret) {
        return res.status(400).json({
          success: false,
          message: "Stripe secret key is not configured",
        });
      }

      const stripeClient = require("stripe")(secret);
      await stripeClient.balance.retrieve();

      return res.json({
        success: true,
        provider: "stripe",
        message: "Stripe connection successful",
      });
    }

    if (provider === "paypal") {
      const enabled = settings.paymentSettings?.methods?.paypal?.enabled;
      if (!enabled) {
        return res
          .status(400)
          .json({ success: false, message: "PayPal is disabled" });
      }

      const clientId =
        settings.paymentSettings?.credentials?.paypal?.clientId ||
        process.env.PAYPAL_CLIENT_ID;
      const clientSecret =
        decryptSecret(
          settings.paymentSettings?.credentials?.paypal?.clientSecret,
        ) || process.env.PAYPAL_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          message: "PayPal credentials are not configured",
        });
      }

      const baseUrl =
        process.env.PAYPAL_BASE_URL ||
        (process.env.NODE_ENV === "production"
          ? "https://api-m.paypal.com"
          : "https://api-m.sandbox.paypal.com");

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      );
      const tokenResp = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenResp.ok) {
        const text = await tokenResp.text();
        return res.status(400).json({
          success: false,
          message: "PayPal connection failed",
          details: text,
        });
      }

      return res.json({
        success: true,
        provider: "paypal",
        message: "PayPal connection successful",
      });
    }

    return res
      .status(400)
      .json({ success: false, message: "Unsupported provider" });
  } catch (err) {
    console.error("testPaymentConnection error", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  ensureSettings,
  getAdminSettings,
  getPublicSettings,
  updateSettings,
  uploadImage,
  sendTestEmail,
  deleteSettings,
  testPaymentConnection,
};
