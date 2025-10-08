// models/Notification.js
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { 
      type: DataTypes.ENUM('application', 'invitation', 'message', 'system'), 
      allowNull: false 
    },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
    related_entity_type: { type: DataTypes.STRING, allowNull: true },
    related_entity_id: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'notifications',
    timestamps: true,
    indexes: [
      {
        fields: ['user_id', 'is_read']
      }
    ]
  });

  Notification.associate = function(models) {
    Notification.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return Notification;
};