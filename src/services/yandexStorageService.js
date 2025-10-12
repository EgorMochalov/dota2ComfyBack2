// services/yandexStorageService.js
const AWS = require('aws-sdk');
const path = require('path');

class YandexStorageService {
  constructor() {
    this.s3 = new AWS.S3({
      endpoint: 'https://storage.yandexcloud.net',
      region: 'ru-central1',
      credentials: {
        accessKeyId: process.env.YANDEX_CLOUD_ACCESS_KEY_ID,
        secretAccessKey: process.env.YANDEX_CLOUD_SECRET_ACCESS_KEY
      }
    });
    
    this.bucketName = process.env.YANDEX_CLOUD_BUCKET_NAME || 'dota2-avatars';
  }

  // Загрузка файла в Yandex Cloud
  async uploadFile(file, prefix = 'avatars') {
    try {
      const fileExtension = path.extname(file.originalname);
      const fileName = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
      
      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read' // Файл будет публично доступен
      };

      const result = await this.s3.upload(params).promise();
      
      return {
        url: result.Location,
        key: result.Key,
        filename: fileName
      };
    } catch (error) {
      console.error('Error uploading to Yandex Cloud:', error);
      throw new Error('Failed to upload file to cloud storage');
    }
  }

  // Удаление файла из Yandex Cloud
  async deleteFile(fileUrl) {
    try {
      // Извлекаем ключ файла из URL
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1); // Убираем первый слеш
      
      const params = {
        Bucket: this.bucketName,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      console.error('Error deleting file from Yandex Cloud:', error);
      return false;
    }
  }

  // Получение публичного URL файла
  getPublicUrl(key) {
    return `https://${this.bucketName}.storage.yandexcloud.net/${key}`;
  }

  // Проверка подключения
  async testConnection() {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      return true;
    } catch (error) {
      console.error('Yandex Cloud connection test failed:', error);
      return false;
    }
  }
}

module.exports = new YandexStorageService();