"use strict";

var fs = require("fs");
var path = require("path");
var Sequelize = require("sequelize");
var env = process.env.NODE_ENV || "development";
//use sequelize without any operators aliases
var DBURL = process.env.JAWSDB_MARIA_URL || "mysql://root:@localhost:3306/trackparis";

var sequelize = new Sequelize(DBURL, { operatorsAliases: false });
var db = {};

fs
  .readdirSync(__dirname)
  .filter(function(file) {
    return file.indexOf(".") !== 0 && file !== "index.js";
  })
  .forEach(function(file) {
    var model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(function(modelName) {
  if ("associate" in db[modelName]) {
    console.log("RUN ASSOC for:", modelName);
    db[modelName].associate(db);
    db[modelName].sync();
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
