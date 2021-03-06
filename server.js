var xml2js = require("xml2js");

var parser = new xml2js.Parser({ explicitArray: false });
var express = require("express");
var app = express();
var request = require("request");
// var mongo = require('mongoskin');
var server = require("http").createServer(app);
var io = require("socket.io").listen(server);
var dotenv = require("dotenv");
var _ = require("underscore");

const models = require("./models");

io.set("log level", 1);

var cors = require("cors");

// app.use(cors());//enable cors

var MongoClient = require("mongodb").MongoClient,
  assert = require("assert");

dotenv.load(); //use env files

var devices = {};

// console.log('AUTH:',process.env.MONGODB_URI);

// var db = mongo.db(process.env.MONGODB_URI, {safe: true});
// var db = mongo.db(process.env.MONGODB_URI, {w:1});

var db;

var DBURL = process.env.MONGODB_URI || "";

console.log("DB URL:", DBURL);

MongoClient.connect(DBURL, function(err, thisdb) {
  assert.equal(null, err);
  console.log("Connected correctly to mongo DB server");

  db = thisdb;

  var collections = {
    // 'pings': db.collection('pings')
    points: db.collection("points_jan19")
  };

  db.collection("points_jan19").ensureIndex([["geo", "2dsphere"]], false, function(err, replies) {
    if (err) {
      console.log(err);
    }
  });

  db.collection("points_jan19").ensureIndex("date", false, function(err, replies) {
    if (err) {
      console.log(err);
    }
  });

  io.on("connection", function(socket) {
    //Send on connect
    /*
    collections.points.find({}).sort({ _id: -1 }).limit(3000).toArray(function(err, docs) {
      assert.equal(err, null);
      socket.emit("positions", {
        positions: docs
      });
    });
    */
  });
});

app.use(function(req, res, next) {
  var data = "";
  req.on("data", function(chunk) {
    data += chunk;
  });
  req.on("end", function() {
    req.rawBody = data;
    next();
  });
});

app.use(express.logger("dev"));

// db.collection('points').ensureIndex([['geo', '2dsphere']], false, function (err, replies) {
//   if (err) {
//     console.log(err);
//   }
// });

// db.collection('points').ensureIndex('date', false, function (err, replies) {
//   if (err) {
//     console.log(err);
//   }
// });

function transformHeader(data, result) {
  result.id = parseInt(data.bwiredtravel.travel.id);
  result.getTripUrl = data.bwiredtravel.travel.getTripUrl;
  result.description = data.bwiredtravel.travel.description;
  result.length = data.bwiredtravel.travel.length;
  result.time = data.bwiredtravel.travel.time;
  result.tpoints = data.bwiredtravel.travel.tpoints;
  result.uplpoints = data.bwiredtravel.travel.uplpoints;
  result.user = data.bwiredtravel.username;
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
    type: "Point",
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
  db
    .collection("points")
    .find({ user: "byborre2" }, { limit: 1, sort: { date: -1 } })
    .toArray(function(err, items) {
      if (items.length >= 1) {
        io.sockets.emit("location", {
          user: items[0].user,
          lat: items[0].lat,
          lon: items[0].lon,
          course: items[0].course
        });
        //Broadvast all cached locs
        io.sockets.emit("locs", devices);
      }
    });
}

var PORT = process.env.PORT || 3000;
server.listen(PORT);

console.log("SERVER LISTENING ON ", PORT);

app.get("/", function(req, res) {
  res.sendfile(__dirname + "/index.html");
});

app.post("/api/gps", function(req, res) {
  var response = {};
  parser.parseString(req.rawBody, function(err, result) {
    console.log("Incomming:");
    console.log(JSON.stringify(result));

    if (result.bwiredtravel.password != process.env.ADMIN_PASS) {
      console.log("POST WITH WRONG PASS");
      return false;
    }

    var points = transform(result, response);

    db.collection("points").insert(points, function(err) {
      if (err) {
        return console.log("insert error", err);
      }
      console.log("POINTs LEN:", points.length);
      // console.log("POINTs:", JSON.stringify(point));
      //Find latest point (highest ID)
      var lastpoint = _.max(points, function(thispoint) {
        return thispoint.ttime;
      });

      if (lastpoint) {
        var curpoint = {
          user: lastpoint.user,
          lat: lastpoint.lat,
          lon: lastpoint.lon,
          course: lastpoint.course
        };
        devices[lastpoint.user] = curpoint;

        models.GPS.create(curpoint, {}).then(dbres => {
          // res.redirect('/dooproepen')
          // res.redirect("/admin/oproepen");
        });

        io.sockets.emit("location", curpoint);
      }
      // sendLatestCoordinates();
    });
    // console.log(response);
    res.send(JSON.stringify(response));
  });
});

var instacache = null;
var instatime = 0;

//Make instagram proxy so we dont have to expose API key // Oops, repo is public anyway...
app.get("/instagram", cors(), function(req, res) {
  // res.sendfile(__dirname + '/index.html');
  var curtime = new Date().getTime();
  var diff = 1000 * 60 * 5; //5 min
  if (instatime > curtime - diff && instacache != null) {
    res.send(instacache);
  } else {
    request.get(
      "https://api.instagram.com/v1/users/self/media/recent/?access_token=32227036.f3c234e.e692f6979657454c9b75f99aeb6fbda8&",
      function(error, response, body) {
        if (error) {
          console.log("Insta Error:", error);
          return;
        }
        instacache = body;
        instatime = curtime;
        res.send(instacache);
      }
    );
  }
  // request.get('https://api.instagram.com/v1/users/self/media/recent/?access_token=32227036.f3c234e.e692f6979657454c9b75f99aeb6fbda8&').pipe(res)
});

app.get("/geojson/:user", function(req, res) {
  // res.send(req.params.user);
  // return;
  models.GPS.findAll({
    where: {
      user: req.params.user
      // ReservationId: { [Sequelize.Op.in]: ReservationIds } // IN [1, 2]}
    },
    raw: true
    // order: [["user", "ASC"]] //get latest if card is reused / re checked in
  }).then(Points => {
    if (!Points) {
      //No card
      return;
      res.send("Err");
    }

    // console.log("Got points", Points.length);

    var tracks = {};

    var features = [];

    _.each(Points, function(point) {
      if (!tracks[point.user]) {
        tracks[point.user] = [];
      }
      tracks[point.user].push([point.lon, point.lat]);
      console.log("point", point);
    });

    console.log("Got tracks", tracks.length);

    _.each(tracks, function(track, user) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: track
        },
        properties: {
          name: "Route " + user
        }
      });
    });

    var out = {
      type: "FeatureCollection",
      features: features
    };

    res.send(out);
  });
});

// http.createServer(function (req, resp) {
//   if (req.url === '/doodle.png') {
//     if (req.method === 'PUT') {
//       req.pipe(request.put('http://mysite.com/doodle.png'))
//     } else if (req.method === 'GET' || req.method === 'HEAD') {
//       request.get('http://mysite.com/doodle.png').pipe(resp)
//     }
//   }
// })

io.sockets.on("connection", function(socket) {
  sendLatestCoordinates();
});
