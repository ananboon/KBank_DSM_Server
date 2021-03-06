'use strict';
var PORT = 443;
// let app = require('express')();
// let http = require('http').Server(app);
// let io = require('socket.io').listen(http);
// let mysql = require('mysql');
// let Promise = require('bluebird');

const express = require('express');
// var session = require("express-session")({
//     secret: "my-secret",
//     cookie: { maxAge: 10*1000 },
//     resave: true,
//     saveUninitialized: true
// });
// var sharedsession = require("express-socket.io-session");

const app = express();

var request = require('request');
var path = require('path');
var fs = require('fs');

// var cors = require('cors');

var options = {
  key: fs.readFileSync(path.join(__dirname,'ssl_cert','dsm.key') ),
  cert: fs.readFileSync(path.join(__dirname,'ssl_cert','dsm.crt') ),
};

let mysql = require('mysql');
let Promise = require('bluebird');

var https = require('https');
var server = https.createServer(options, app);
let io = require('socket.io')(server,{'pingInterval': 20000, 'pingTimeout': 50000});
// io.use(sharedsession(session, {
//     autoSave:true
// })); 


// app.use(session);
app.use(express.static(path.join(__dirname,'dist'))); /// load resource
app.use('/proxy/*', function(req, res) {
  req.pipe(request("https://" + req.params[0])).pipe(res);
});
app.get('*', function(req, res) {
  console.log(req.originalUrl)

  if(req.params[0] == "/WebResource.axd"){
    req.pipe(request("https://k-invest.kasikornbankgroup.com/" + req.originalUrl)).pipe(res);
  }
  // else if(req.params[0] == "/api/uploadSharePointScript"){

  //   fs.readFile(path.join(__dirname,'SharePointScript','uploadtoSharePoint.ps1'), 'utf8', function (err,data) {
  //     if (err) {
  //       return console.log(err);
  //     }
  //     res.status(200).json(data);
 
  //   });
  // }
  else{
    res.sendFile(path.join(__dirname,'dist','index.html')); // load the single view file (angular will handle the page changes on the front-end)
  }
});

let dbUsername = 'root';
let dbPassword = 'root';
let dbHost = 'localhost';
let databaseKbank = 'kbank_dsm';

var pool = mysql.createPool({
  connectionLimit: 1000,
  host: dbHost,
  user: dbUsername,
  password: dbPassword,
  database: databaseKbank
});


global.rooms = {};

const rowCounter = 'RowCounter';
const customer = 'Customer';

const noRoom = 'ไม่มี user คนนี้ที่เชื่อมต่ออยู่';
const userAlreadyInRoom = 'มี user นี้เข้าใช้งานอยู่แล้ว';
const roomFull = 'ขณะนี้ห้องนี้เต็มแล้ว';
const incorrect = 'กรุณาตรวจสอบข้อมูลใหม่อีกครั้ง';

////////////////////////////////////////////////////////////////////////////////////////////


io.on('connection', (socket) => {
  console.log('USER Load Page');
  var room = null;
  // socket.setTimeout(5*100,() => console.log('timeouttt') );
  socket.on('message', (message) => {
    if(message.component === 'login'){
      var role = message.message.role;
      var username = message.message.username;
      var password = message.message.password;

      // getDatabaseConnection()
      // .then(queryUserData.bind(null,username,password)).catch(errorHandler(socket,null,incorrect))
      // .then(getUserData.bind(null,socket)).catch(errorHandler(socket,null,incorrect));

      // getDatabaseConnection()
      // // .then(queryUserData.bind(null,username,password))
      // // .then(getUserData.bind(null,socket))
      // .catch(errorHandler(socket,null,incorrect));

     
      getDatabaseConnection()
      .then( (connection) =>  queryUserData(username,password,connection) )
      .then( (rows) => getUserData(socket,rows) )
      .catch((error) => errorHandler(socket,null,incorrect));

    }else if(message.component === 'connect'){
      var role = message.message.role;
      var roomId = message.message.roomId;

      checkNumOfUsersInRoom(socket,role,roomId);
      // console.log('socket.handshake.session.userdata on device connect',socket.handshake.session.userdata);
    }else if(message.component === 'logout'){
      var roomId = message.message;
      socket.leave(roomId);
      // console.log('Logout ::',message);
      // console.log('Logout message.clientId ::',message.clientId);
      if(io.sockets.adapter.rooms[roomId] !== undefined){
        io.sockets.connected[message.clientId].leave(roomId);
        socket.broadcast.to(message.clientId).emit('message',message);
      }

      delete rooms[roomId];
      console.log(rooms);
    }else{
      // console.log('session expire before',socket.handshake.session.cookie.expires);
      // console.log('new Date(Date.now()',new Date(Date.now()) );
      // if(socket.handshake.session.cookie.expires < new Date(Date.now())){
      //   let roomId = socket.handshake.session.userdata.id;
      //   let messageLogOut = {component : 'logout' , message : roomId};
      //   io.sockets.connected[message.clientId].leave(roomId);
      //   socket.broadcast.to(roomId).emit('message',messageLogOut);
      //   console.log('userdata in session',socket.handshake.session.userdata);
      //   socket.handshake.session.destroy();
      //   console.log('userdata in session after destroy',socket.handshake.session);
      //   console.log('session already expire');
      // }else{

      //   socket.handshake.session.touch();
      //   console.log('session expire after touch at',socket.handshake.session.cookie.expires);
      //   console.log('session already alive');
      // }

      // console.log('message',message);
      socket.broadcast.to(message.clientId).emit('message',message);
    }
  });

  socket.on('disconnect', ()=> {

    // console.log('User disconnected : '+socket.nickname);
    // console.log('socket.handshake.session.userdata before delete',socket.handshake.session.userdata);
    if(socket.nickname !== undefined){
      // Send message to tell the other client to go back to home or connect
      let string = socket.nickname.split(" ");
      let role = string[0];
      let roomId = string[1];



      if(role === rowCounter){
        let message = {
          component: "logout",
          message: roomId
        };
        socket.broadcast.in(roomId).emit('message', message);
        delete io.sockets.adapter.rooms[roomId];
        delete rooms[roomId];
        // if (socket.handshake.session.userdata) {
        //     console.log('socket.handshake.session.userdata before delete',socket.handshake.session.userdata);
        //     delete socket.handshake.session.userdata;
        //     socket.handshake.session.save();
        //     console.log('socket.handshake.session after delete',socket.handshake.session.userdata);
        //     console.log('socket.handshake.session after delete',socket.handshake.session);
        // }
      }else{
        // to home and stop recording;
        let message = {
          component: "stop-recording",
          message: 'redirect-to-home'
        };
        socket.broadcast.in(roomId).emit('message', message);
      }
    }
  });

  socket.on('connect_timeout', (timeout) => {
    console.log('connect timeout',timeout);
  });

});

////////////////////////////////////////////////////////////////////////////////////////////

function errorHandler(socket,error,message){
  console.log('error handler');
  var message = {
    component: 'login-error',
    message: message
  }
  socket.emit('message',message);
}

function getDatabaseConnection(){
  var promise = new Promise((resolve,reject) => {
    pool.getConnection((error,connection) => {
      if(error){
        connection.release();
        reject(error);
      }else{
        resolve(connection);
      }
    });
  });
  return promise;
}

function queryUserData(username,password,connection){

  var query = 'SELECT Id, FirstName, LastName, Position, Location FROM Users WHERE Username = ? AND Password = ?';
  var values = [username,password];
  var statement = mysql.format(query,values);

  var promise = new Promise((resolve,reject) => {
    connection.query(statement, (error,rows) => {
      if(error){
        console.log('error',error);
        reject(error);
      }else{
        console.log('rows',rows);
        resolve(rows);
      }
      connection.release();
    });
  });
  return promise;
}

function getUserData(socket,rows){
  var roomId = rows[0].Id;

  var user = {
    id: rows[0].Id,
    firstname: rows[0].FirstName,
    lastname: rows[0].LastName,
    position: rows[0].Position,
    location: rows[0].Location
  }

  // var message = {
  //   component: 'user-data',
  //   message: user
  // };

  if(rooms[roomId] === undefined){
      var message = {
        component: 'user-data',
        message: user,
        success: true
      };

      socket.nickname = rowCounter+' '+roomId;
      socket.join(roomId);

      rooms[roomId] = user;
      // console.log('socket.handshake.session.save();',socket.handshake.session);

      socket.emit('message',message);
  }else{
    
    errorHandler(socket,null,userAlreadyInRoom)

  }



  // socket.nickname = rowCounter+' '+roomId;
  // socket.join(roomId);

  // rooms[roomId] = user;

  // socket.emit('message',message);
}

function checkNumOfUsersInRoom(socket,role, roomId){
    // Check if room full

    var clients = io.sockets.adapter.rooms[roomId];
    var clientToSendTo;
    var message;

    if(role === customer && typeof clients !== 'undefined' && Object.keys(clients.sockets).length < 2){
      socket.nickname = customer+' '+roomId;
      socket.join(roomId);

      var clients = io.sockets.adapter.rooms[roomId].sockets;
      var rowCounterId = Object.keys(clients)[0];
      var customerId = Object.keys(clients)[1];

      sendUserData(socket,roomId);

      setClientToSendTo(socket,rowCounterId);
      setClientToSendTo(socket.broadcast.to(rowCounterId),customerId);
    }else if(role === customer && typeof clients === 'undefined'){
      sendRoomStatus(socket,noRoom);
    }else{
      sendRoomStatus(socket,roomFull);
    }
}


function setClientToSendTo(socket,idToSend){
  var message = {
    component: 'set-client-id-to-send-to',
    message: idToSend
  };
  socket.emit('message',message);
}

function sendRoomStatus(socket,status){
  var message = {
    component: 'get-room-status',
    message: status
  };
  socket.emit('message',message);
}

function sendUserData(socket,roomId){
  var user = rooms[roomId];
  var message = {
    component: 'user-data',
    message: user
  };
  socket.emit('message',message);
}

// app.get("/api/room", function(req, res) {
//       let room = io.sockets.adapter.rooms[1];
//       if(room === undefined){
//         handleError(res,'reasonsd','No Room','200');
//       }else{
//         res.status(200).json(room.length);
//       }

// });


function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}

//////////////////////////////////////////////////////////////////////////////////////////

server.listen(PORT, function() {
  console.log('server up and running at %s adress', server.address().address);
  console.log('server up and running at %s port', PORT);
});

