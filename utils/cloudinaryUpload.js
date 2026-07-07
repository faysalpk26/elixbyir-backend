const fs = require("fs");
const cloudinary = require("../config/cloudinary.js");

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    // ignore file cleanup errors
  }
};

// Upload single file to Cloudinary
exports.uploadToCloudinary = async (file, options = {}) => {
  const folder = options.folder || "Pink_Dreams";

  if (!file?.path) {
    throw new Error("No file path found for Cloudinary upload.");
  }

  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: "image",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });

    return {
      public_id: result.public_id,
      url: result.secure_url,
    };
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  } finally {
    safeUnlink(file.path);
  }
};

// Upload multiple files to Cloudinary
exports.uploadMultipleToCloudinary = async (files, options = {}) => {
  const folder = options.folder || "Pink_Dreams";
  const results = [];

  try {
    for (const file of files || []) {
      const uploaded = await exports.uploadToCloudinary(file, { folder });
      results.push(uploaded);
    }
    return results;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

// Delete file from Cloudinary
exports.deleteFromCloudinary = async (public_id) => {
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

module.exports = exports;
