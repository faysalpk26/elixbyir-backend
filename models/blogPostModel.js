const mongoose = require("mongoose");

const BlogPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    shortDescription: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    author: {
      name: {
        type: String,
        required: true,
      },
      profileImage: {
        type: String,
      },
      bio: {
        type: String,
      },
    },
    category: {
      type: String,
      required: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    featured: {
      type: Boolean,
      default: false,
    },
    trending: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    
    available: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
    },

    readTime: {
      type: Number,
    },

    likes: {
      count: {
        type: Number,
        default: 0,
      },
      users: [
        {
          type: Number,
        },
      ],
    },
    views: {
      type: Number,
      default: 0,
    },

    comments: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        user: {
          type: Object,
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
        },
        replies: [
          {
            _id: {
              type: mongoose.Schema.Types.ObjectId,
              default: () => new mongoose.Types.ObjectId(),
            },
            user: {
              type: Object,
              required: true,
            },
            text: {
              type: String,
              required: true,
              trim: true,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    commentsEnabled: {
      type: Boolean,
      default: true,
    },

    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
    },

    metaTitle: {
      type: String,
    },
    metaDescription: {
      type: String,
    },

    metaKeywords: [String],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("BlogPost", BlogPostSchema);
