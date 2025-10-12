// services/yandexStorageService.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class YandexStorageService {
  constructor() {
    this.s3Client = new S3Client({
      region: 'ru-central1',
      endpoint: 'https://storage.yandexcloud.net',
      credentials: {
        accessKeyId: process.env.YC_ACCESS_KEY_ID,
        secretAccessKey: process.env.YC_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.YC_BUCKET_NAME || 'dota2-avatars';
  }

  // Генерация подписанного URL для загрузки
  async generateUploadUrl(key, contentType) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        ACL: 'public-read',
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: 3600 // 1 час
      });

      return {
        uploadUrl: signedUrl,
        publicUrl: `https://storage.yandexcloud.net/${this.bucketName}/${key}`
      };
    } catch (error) {
      console.error('Error generating upload URL:', error);
      throw error;
    }
  }

  // Удаление файла
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  // Генерация уникального имени файла
  generateFileName(originalName, prefix = 'avatars') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    return `${prefix}/${timestamp}_${random}.${extension}`;
  }
}

module.exports = new YandexStorageService();