// utils/fileUtils.js
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

const ensureUploadDir = async () => {
  try {
    await fs.access(config.upload.uploadPath);
  } catch (error) {
    await fs.mkdir(config.upload.uploadPath, { recursive: true });
  }
};

const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

const isValidImageType = (mimetype) => {
  return config.upload.allowedMimeTypes.includes(mimetype);
};

const generateFileName = (originalName, prefix = 'avatar') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = getFileExtension(originalName);
  return `${prefix}_${timestamp}_${random}${extension}`;
};

module.exports = {
  ensureUploadDir,
  deleteFile,
  getFileExtension,
  isValidImageType,
  generateFileName
};