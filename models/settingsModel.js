// File: models/Settings.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const PaymentMethodSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, default: "" },
    instructions: { type: String, default: "" }, // used by bank transfer
  },
  { _id: false },
);

const StripeCredentialsSchema = new Schema(
  {
    publishableKey: { type: String, default: "" },
    secretKey: { type: String, default: "" }, // encrypted string
    webhookSecret: { type: String, default: "" }, // encrypted string
  },
  { _id: false },
);

const PaypalCredentialsSchema = new Schema(
  {
    clientId: { type: String, default: "" },
    clientSecret: { type: String, default: "" }, // encrypted string
  },
  { _id: false },
);

const HoursSchema = new Schema(
  {
    day: { type: String, default: "weekday" }, // e.g. 'weekdays'
    open: { type: String, default: "09:00" }, // '09:00'
    close: { type: String, default: "18:00" }, // '18:00'
    closed: { type: Boolean, default: false },
  },
  { _id: false },
);

const ImageRef = new Schema(
  {
    public_id: { type: String, default: "" },
    url: { type: String, default: "" },
    alt: { type: String, default: "" },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false },
);

const hexColorField = (defaultValue) => ({
  type: String,
  trim: true,
  default: defaultValue,
  match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color value"],
});

const ThemeSettingsSchema = new Schema(
  {
    brand: {
      primary: hexColorField("#ec4899"),
      primaryHover: hexColorField("#db2777"),
      secondary: hexColorField("#f43f5e"),
      accent: hexColorField("#be185d"),
      gradientFrom: hexColorField("#ec4899"),
      gradientTo: hexColorField("#f43f5e"),
    },
    text: {
      heading: hexColorField("#111827"),
      body: hexColorField("#374151"),
      muted: hexColorField("#6b7280"),
      onPrimary: hexColorField("#ffffff"),
    },
    background: {
      page: hexColorField("#fff7fb"),
      section: hexColorField("#ffffff"),
      card: hexColorField("#ffffff"),
    },
    border: {
      default: hexColorField("#e5e7eb"),
    },
    buttonPrimary: {
      bg: hexColorField("#ec4899"),
      hover: hexColorField("#db2777"),
      text: hexColorField("#ffffff"),
    },
    buttonSecondary: {
      bg: hexColorField("#ffffff"),
      hover: hexColorField("#fdf2f8"),
      text: hexColorField("#be185d"),
      border: hexColorField("#f9a8d4"),
    },
    state: {
      success: hexColorField("#10b981"),
      warning: hexColorField("#f59e0b"),
      error: hexColorField("#ef4444"),
      info: hexColorField("#3b82f6"),
    },
  },
  { _id: false },
);

const SettingsSchema = new Schema(
  {
    generalSettings: {
      branding: {
        siteLogo: {
          type: ImageRef,
          default: () => ({
            public_id: "default_site_logo",
            url: "https://placehold.co/400x100/FFB6C1/FFFFFF?text=Pink+Dreams",
            alt: "Pink Dreams Logo",
            uploadedAt: new Date(),
          }),
        },
        adminLogo: {
          type: ImageRef,
          default: () => ({
            public_id: "default_admin_logo",
            url: "https://placehold.co/200x60/FFB6C1/FFFFFF?text=Admin+Logo",
            alt: "Admin Logo",
            uploadedAt: new Date(),
          }),
        },
        favicon: {
          type: ImageRef,
          default: () => ({
            public_id: "default_favicon",
            url: "https://placehold.co/32x32/FFB6C1/FFFFFF?text=P",
            alt: "Favicon",
            uploadedAt: new Date(),
          }),
        },
      },
      seo: {
        siteTitle: {
          type: String,
          default: "Pink Dreams - Premium Fashion Store",
        },
        siteDescription: {
          type: String,
          default:
            "Discover the latest trends in fashion. Shop premium clothing, accessories, and more at Pink Dreams.",
        },
        // add other SEO fields (robots, default meta tags) as needed
      },
    },

    contact: {
      email: { type: String, trim: true, default: "hello@pinkdreams.com" },
      phone: { type: String, trim: true, default: "+1 (555) 123-4567" },
      address: {
        type: String,
        trim: true,
        default: "123 Fashion Avenue, Suite 456, New York, NY 10001, United States",
      },

      social: {
        instagram: {
          type: String,
          default: "https://instagram.com/pinkdreams",
        },
        facebook: { type: String, default: "https://facebook.com/pinkdreams" },
        twitter: { type: String, default: "https://twitter.com/pinkdreams" },
        youtube: { type: String, default: "https://youtube.com/pinkdreams" },
      },

      // business hours as three logical entries: weekdays, saturday, sunday
      hours: {
        weekdays: {
          type: HoursSchema,
          default: () => ({
            day: "weekdays",
            open: "09:00",
            close: "18:00",
            closed: false,
          }),
        },
        saturday: {
          type: HoursSchema,
          default: () => ({
            day: "saturday",
            open: "10:00",
            close: "16:00",
            closed: false,
          }),
        },
        sunday: {
          type: HoursSchema,
          default: () => ({
            day: "sunday",
            open: "00:00",
            close: "00:00",
            closed: true,
          }),
        },
      },
    },

    email: {
      from: { type: String, default: "noreply@pinkdreams.com" }, // visible sender address
      admin: { type: String, default: "admin@pinkdreams.com" }, // admin notification address
    },
    allowGuestCheckout: { type: Boolean, default: true },
    themeSettings: {
      type: ThemeSettingsSchema,
      default: () => ({}),
    },
    
    paymentSettings: {
      methods: {
        stripe: {
          type: PaymentMethodSchema,
          default: () => ({ enabled: true, label: "Card (Stripe)" }),
        },
        paypal: {
          type: PaymentMethodSchema,
          default: () => ({ enabled: true, label: "PayPal" }),
        },
        cod: {
          type: PaymentMethodSchema,
          default: () => ({ enabled: false, label: "Cash on Delivery" }),
        },
        bankTransfer: {
          type: PaymentMethodSchema,
          default: () => ({
            enabled: false,
            label: "Bank Transfer",
            instructions: "",
          }),
        },
      },
      credentials: {
        stripe: {
          type: StripeCredentialsSchema,
          default: () => ({
            publishableKey: "",
            secretKey: "",
            webhookSecret: "",
          }),
        },
        paypal: {
          type: PaypalCredentialsSchema,
          default: () => ({ clientId: "", clientSecret: "" }),
        },
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settings", SettingsSchema);
