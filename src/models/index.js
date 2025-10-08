// models/index.js
const { Sequelize } = require('sequelize');
const config = require('../config/database.js')[process.env.NODE_ENV || 'production'];
console.log(config)
const sequelize = new Sequelize(config);

const db = {
  sequelize,
  Sequelize,
  User: require('./User')(sequelize, Sequelize.DataTypes),
  Team: require('./Team')(sequelize, Sequelize.DataTypes),
  TeamApplication: require('./TeamApplication')(sequelize, Sequelize.DataTypes),
  Invitation: require('./Invitation')(sequelize, Sequelize.DataTypes),
  ChatRoom: require('./ChatRoom')(sequelize, Sequelize.DataTypes),
  ChatMessage: require('./ChatMessage')(sequelize, Sequelize.DataTypes),
  ChatRoomMember: require('./ChatRoomMember')(sequelize, Sequelize.DataTypes),
  UserBlock: require('./UserBlock')(sequelize, Sequelize.DataTypes),
  Notification: require('./Notification')(sequelize, Sequelize.DataTypes),
};

// Установка ассоциаций
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;