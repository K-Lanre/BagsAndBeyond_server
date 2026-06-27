'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Promo extends Model {}

  Promo.init({
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    subtitle: {
      type: DataTypes.STRING
    },
    description: {
      type: DataTypes.TEXT
    },
    image: {
      type: DataTypes.STRING
    },
    button_text: {
      type: DataTypes.STRING,
      defaultValue: 'Shop Now'
    },
    button_link: {
      type: DataTypes.STRING,
      defaultValue: '/shop'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    position: {
      type: DataTypes.ENUM('hero', 'featured', 'popup', 'announcement'),
      defaultValue: 'hero'
    },
    display_on: {
      type: DataTypes.JSON,
      defaultValue: ['desktop', 'mobile']
    }
  }, {
    sequelize,
    modelName: 'Promo',
    tableName: 'promos',
    underscored: true
  });

  return Promo;
};
