var xml2js = require('xml2js');

var parser = new xml2js.Parser({explicitArray : false});
var express = require('express');
var app = express();
var mongo = require('mongoskin');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var dotenv         = require('dotenv');
dotenv.load(); //use env files


console.log('AUTH:',process.env.MONGODB_URI);

// var db = mongo.db(process.env.MONGODB_URI, {safe: true});
var db = mongo.db(process.env.MONGODB_URI, {w:1});

app.use(function(req, res, next) {
  var data = "";
  req.on('data', function(chunk) {
    data += chunk}
  )
  req.on('end', function() {
    req.rawBody = data;
    next();
  })
});

app.use(express.logger('dev'));

db.collection('points').ensureIndex([['geo', '2dsphere']], false, function (err, replies) {
  if (err) {
    console.log(err);
  }
});

db.collection('points').ensureIndex('date', false, function (err, replies) {
  if (err) {
    console.log(err);
  }
});


function transformHeader(data, result) {
  result.id = parseInt(data.bwiredtravel.travel.id);
  result.getTripUrl = data.bwiredtravel.travel.getTripUrl;
  result.description = data.bwiredtravel.travel.description;
  result.length = data.bwiredtravel.travel.length;
  result.time = data.bwiredtravel.travel.time;
  result.tpoints = data.bwiredtravel.travel.tpoints;
  result.uplpoints = data.bwiredtravel.travel.uplpoints;
}

function transformPoint(point, result) {
  result.pointId = parseInt(point.id);
  result.date = parseFloat(point.date);
  result.lat = parseFloat(point.lat);
  result.lon = parseFloat(point.lon);
  result.speed = parseFloat(point.speed);
  result.course = parseFloat(point.course);
  result.haccu = parseFloat(point.haccu);
  result.bat = parseFloat(point.bat);
  result.vaccu = parseFloat(point.vaccu);
  result.altitude = parseFloat(point.altitude);
  result.continous = parseFloat(point.continous);
  result.tdist = parseFloat(point.tdist);
  result.rdist = parseFloat(point.rdist);
  result.ttime = parseFloat(point.ttime);
  result.geo = {
    type: 'Point',
    coordinates: [result.lon, result.lat]
  };

  return result.pointId;
}

function transform(data, response) {
  var points = [];

  response.id = 0;
  response.tripid = parseInt(data.bwiredtravel.travel.id);
  response.points = [];
  response.valid = true;

  if (data.bwiredtravel.travel.point instanceof Array) {
    data.bwiredtravel.travel.point.forEach(function(point) {
      var result = {};
      transformHeader(data, result);
      response.points.push(transformPoint(point, result));
      points.push(result);
    });
  } else {
    var result = {};
    transformHeader(data, result);
    response.points.push(transformPoint(data.bwiredtravel.travel.point, result));
    points.push(result);
  }
  return points;
}

function sendLatestCoordinates() {
  db.collection('points').find({}, {limit: 1, sort: {date: -1}}).toArray(function (err, items) {
    if (items.length >= 1) {
      io.sockets.emit('location', {
        lat: items[0].lat,
        lon: items[0].lon
      });
    }
  });
}


var PORT=process.env.PORT||3000;
server.listen(PORT);

console.log('SERVER LISTENING ON ',PORT);

app.get('/', function(req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.post('/api/gps', function(req, res) {
  var response = {};
  parser.parseString(req.rawBody, function (err, result) {
    db.collection('points').insert(transform(result, response), function(err) {
      if (err) {
        return console.log('insert error', err);
      }
      sendLatestCoordinates();
    });
    console.log(response);
    res.send(JSON.stringify(response));
  });
});

io.sockets.on('connection', function (socket) {
  sendLatestCoordinates();
});
