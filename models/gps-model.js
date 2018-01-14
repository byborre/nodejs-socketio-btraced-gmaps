"use strict";

module.exports = function(sequelize, DataTypes) {
  var GPS = sequelize.define(
    "GPS",
    {
      user: {
        type: DataTypes.TEXT("tiny"),
        allowNull: true
      },

      lat: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },

      lon: {
        type: DataTypes.DOUBLE,
        allowNull: true
      },

      course: {
        type: DataTypes.TINYINT,
        allowNull: true
      }
    },
    {
      indexes: [
        // Create a  index on email
        // {
        //   // unique: true,
        //   fields: [{
        //     attribute: 'email',
        //     length: 50
        //   }]
        // }
      ],
      freezeTableName: true,
      paranoid: true
    }
  );

  // helden.associate = function(models) {
  //   helden.hasMany(models.Task);
  // }
  GPS.sync();

  return GPS;
};
