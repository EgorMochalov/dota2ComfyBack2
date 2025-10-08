// models/ChatMessage.js
module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    message: { type: DataTypes.TEXT, allowNull: false },
    message_type: { 
      type: DataTypes.ENUM('text', 'image', 'system'), 
      defaultValue: 'text' 
    }
  }, {
    tableName: 'chat_messages',
    timestamps: true,
    indexes: [
      {
        fields: ['room_id', 'createdAt']
      }
    ]
  });

  ChatMessage.associate = function(models) {
    ChatMessage.belongsTo(models.ChatRoom, { foreignKey: 'room_id' });
    ChatMessage.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return ChatMessage;
};
