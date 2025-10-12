// services/yandexStorageService.js - ОБНОВЛЕННЫЙ С AWS SDK v3
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const path = require('path');

class YandexStorageService {
  constructor() {
    this.s3Client = new S3Client({
      endpoint: 'https://storage.yandexcloud.net',
      region: 'ru-central1',
      credentials: {
        accessKeyId: process.env.YANDEX_CLOUD_ACCESS_KEY_ID,
        secretAccessKey: process.env.YANDEX_CLOUD_SECRET_ACCESS_KEY
      },
      // Дополнительные настройки для лучшей совместимости
      forcePathStyle: false
    });
    
    this.bucketName = process.env.YANDEX_CLOUD_BUCKET_NAME || 'dota2-teammate-finder';
  }

  // Загрузка файла в Yandex Cloud
  async uploadFile(file, prefix = 'avatars') {
    try {
      const fileExtension = path.extname(file.originalname);
      const fileName = `${prefix}/${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read' // Файл будет публично доступен
      });

      const result = await this.s3Client.send(command);
      
      // В v3 результат не содержит Location, формируем URL вручную
      const fileUrl = `https://${this.bucketName}.storage.yandexcloud.net/${fileName}`;
      
      return {
        url: fileUrl,
        key: fileName,
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
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
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
      const command = new HeadBucketCommand({
        Bucket: this.bucketName
      });
      
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Yandex Cloud connection test failed:', error);
      return false;
    }
  }
}

module.exports = new YandexStorageService();