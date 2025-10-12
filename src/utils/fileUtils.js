// utils/fileUtils.js - ОБНОВЛЕННЫЙ
const config = require('../config/config');

const ensureUploadDir = async () => {
  // Больше не нужно создавать локальную директорию
  return true;
};

const deleteFile = async (filePath) => {
  // Больше не нужно удалять локальные файлы
  return true;
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