'use strict';
const { Model } = require('sequelize');
const { generateUniqueSlug } = require('../utils/slugify');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.hasMany(models.OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
    }
  }
  Product.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      unique: true
    },
    description: {
      type: DataTypes.TEXT
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    stock_quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    category: {
      type: DataTypes.ENUM('bags', 'shoes', 'apparel', 'jewelry')
    },
    subcategory: {
      type: DataTypes.STRING,
      allowNull: true
    },
    images: {
      type: DataTypes.JSON
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'low_stock', 'out_of_stock'),
      defaultValue: 'active'
    },
    sku: {
      type: DataTypes.STRING,
      unique: true
    },
    weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    dimensions: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'products',
    underscored: true,
    hooks: {
      beforeCreate: async (product) => {
        if (!product.slug) {
          product.slug = await generateUniqueSlug(product.name, Product);
        }
      },
      beforeUpdate: async (product) => {
        if (product.changed('name') && !product.changed('slug')) {
          product.slug = await generateUniqueSlug(product.name, Product, product.id);
        }
      }
    }
  });
  return Product;
};
