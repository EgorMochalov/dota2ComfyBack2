// models/UserBlock.js
module.exports = (sequelize, DataTypes) => {
  const UserBlock = sequelize.define('UserBlock', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }
  }, {
    tableName: 'user_blocks',
    timestamps: true,
    indexes: [
      {
        fields: ['blocker_user_id', 'blocked_user_id'],
        unique: true
      }
    ]
  });

  UserBlock.associate = function(models) {
    UserBlock.belongsTo(models.User, { 
      foreignKey: 'blocker_user_id', 
      as: 'blocker' 
    });
    UserBlock.belongsTo(models.User, { 
      foreignKey: 'blocked_user_id', 
      as: 'blocked_user' 
    });
  };

  return UserBlock;
};