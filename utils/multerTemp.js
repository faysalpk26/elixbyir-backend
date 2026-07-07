const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Temporary uploads directory
const uploadsDir = path.join(__dirname, '../uploads-temp');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const name = path.parse(file.originalname).name;
    cb(null, `${name}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadMulterTemp = multer({ storage });

module.exports = uploadMulterTemp;
