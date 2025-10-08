// models/ChatRoomMember.js - ОБНОВЛЕННАЯ
module.exports = (sequelize, DataTypes) => {
  const ChatRoomMember = sequelize.define('ChatRoomMember', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    last_read_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'chat_room_members',
    timestamps: true
  });

  ChatRoomMember.associate = function(models) {
    ChatRoomMember.belongsTo(models.ChatRoom, { foreignKey: 'room_id', as: 'room'  });
    ChatRoomMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return ChatRoomMember;
};