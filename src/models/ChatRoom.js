// models/ChatRoom.js - ОБНОВЛЕННАЯ
module.exports = (sequelize, DataTypes) => {
  const ChatRoom = sequelize.define('ChatRoom', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { 
      type: DataTypes.ENUM('private', 'team'), 
      allowNull: false 
    },
    name: { type: DataTypes.STRING, allowNull: true },
    last_activity: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    }
  }, {
    tableName: 'chat_rooms',
    timestamps: true
  });

  ChatRoom.associate = function(models) {
    ChatRoom.belongsTo(models.Team, { 
      foreignKey: 'team_id', 
      as: 'team'
    });
    ChatRoom.hasMany(models.ChatMessage, { 
      foreignKey: 'room_id', 
      as: 'messages' 
    });
    ChatRoom.hasMany(models.ChatRoomMember, { 
      foreignKey: 'room_id', 
      as: 'members' 
    });
  };

  return ChatRoom;
};