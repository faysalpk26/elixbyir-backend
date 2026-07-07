const path = require("path");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");


exports.uploadAuthorProfileImageController = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

       let avatar = "";
    if (req.file) {
      const cloudinaryResult = await uploadToCloudinary(req.file);
      avatar =  cloudinaryResult.url;
    }

    if(!avatar){
      res.json({
        success: false,
        message: "Error while uploading author image",
      });
    }



      undefined;

      res.json({
        success: true,
        message: "Author image uploaded successfully",
        imageUrl: avatar,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("❌ Author image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Author image upload failed",
        error: error.message,
      });
    }
};

exports.uploadBlogImageController = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

       let avatar = "";
    if (req.file) {
      const cloudinaryResult = await uploadToCloudinary(req.file);
      avatar =  cloudinaryResult.url;
    }

    if(!avatar){
      res.json({
        success: false,
        message: "Error while uploading Blog image",
      });
    }



      undefined;

      res.json({
        success: true,
        message: "Blog image uploaded successfully",
        imageUrl: avatar,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("❌ blog image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Blog image upload failed",
        error: error.message,
      });
    }
};

exports.uploadBlogCategoryImageController = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      
       let avatar = "";
    if (req.file) {
      const cloudinaryResult = await uploadToCloudinary(req.file);
      avatar =  cloudinaryResult.url;
    }

    if(!avatar){
      res.json({
        success: false,
        message: "Error while uploading Blog category image",
      });
    }



      undefined;

      res.json({
        success: true,
        message: "Blog Category image uploaded successfully",
        imageUrl: avatar,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("❌ blog Category image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Blog Category image upload failed",
        error: error.message,
      });
    }
};

exports.uploadCategoryImageController = (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      const imageUrl = `${req.protocol}://${req.get("host")}/images/categories/${req.file.filename}`;
      undefined

      undefined;

      res.json({
        success: true,
        message: "Category image uploaded successfully",
        imageUrl: imageUrl,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("❌ Category image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Category image upload failed",
        error: error.message,
      });
    }
};

exports.uploadProductImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: 0,
        message: "No file uploaded",
      });
    }

    const cloudinaryResult = await uploadToCloudinary(req.file, {
      folder: "Pink_Dreams/products",
    });

    return res.json({
      success: 1, // keep numeric for existing frontend compatibility
      image_url: cloudinaryResult.url,
      image_public_id: cloudinaryResult.public_id, // optional, useful for future delete
    });
  } catch (error) {
    console.error("Product image upload error:", error);
    return res.status(500).json({
      success: 0,
      message: "Upload failed",
      error: error.message,
    });
  }
};

exports.uploadBulkProductImagesController = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "No image files uploaded",
      });
    }

    const safeProductKey = String(req.body?.productKey || "")
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    const baseFolder = safeProductKey
      ? `Pink_Dreams/products/${safeProductKey}`
      : "Pink_Dreams/products";

    const uploaded = await Promise.all(
      files.map((file) => uploadToCloudinary(file, { folder: baseFolder })),
    );

    const urls = uploaded.map((item) => item.url).filter(Boolean);

    if (!urls.length) {
      return res.status(500).json({
        success: false,
        message: "Upload failed. No valid Cloudinary URLs returned.",
      });
    }

    const rawPrimaryIndex = Number.parseInt(req.body?.primaryIndex, 10);
    const primaryIndex =
      Number.isInteger(rawPrimaryIndex) &&
      rawPrimaryIndex >= 0 &&
      rawPrimaryIndex < urls.length
        ? rawPrimaryIndex
        : 0;

    const primaryUrl = urls[primaryIndex];
    const additionalUrls = urls.filter((_, index) => index !== primaryIndex);

    return res.json({
      success: true,
      message: "Images uploaded successfully",
      folder: baseFolder,
      urls,
      primaryUrl,
      additionalUrls,
      imagesPipe: additionalUrls.join("|"),
      allPipe: urls.join("|"),
    });
  } catch (error) {
    console.error("Bulk product image upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: error.message,
    });
  }
};


module.exports = exports;
