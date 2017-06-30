'use strict';
let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io').listen(http);
let mysql = require('mysql');
let Promise = require('bluebird');

// let memwatch = require('memwatch-next');
//
// memwatch.on('leak', (info) => {
//   console.log('info');
//   console.log(info);
// });
//
// memwatch.on('stats', (stats) => {
//   console.log('stats');
//   console.log(stats);
// })


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
const roomFull = 'ขณะนี้ห้องนี้เต็มแล้ว';

////////////////////////////////////////////////////////////////////////////////////////////
io.on('connection', (socket) => {
  console.log('USER CONNECTED');
  var room = null;
  socket.on('message', (message) => {
    if(message.component === 'login'){
      var role = message.message.role;
      var username = message.message.username;
      var password = message.message.password;

      getDatabaseConnection()
      .then(queryUserData.bind(null,username,password)).catch(errorHandler.bind(null,socket))
      .then(getUserData.bind(null,socket)).catch(errorHandler.bind(null,socket));


    }else if(message.component === 'connect'){
      var role = message.message.role;
      var roomId = message.message.roomId;

      checkNumOfUsersInRoom(socket,role,roomId);
    }else if(message.component === 'logout'){
      var roomId = message.message;
      socket.leave(roomId);

      if(io.sockets.adapter.rooms[roomId] !== undefined){
        io.sockets.connected[message.clientId].leave(roomId);
        socket.broadcast.to(message.clientId).emit('message',message);
      }

      delete rooms[roomId];
      console.log(rooms);
    }else{
      socket.broadcast.to(message.clientId).emit('message',message);
    }
  });

  socket.on('disconnect', ()=> {

    console.log('User disconnected : '+socket.nickname);

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
});

////////////////////////////////////////////////////////////////////////////////////////////

function errorHandler(socket,error){
  var message = {
    component: 'login-error',
    message: 'Error'
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
        reject(error);
      }else{
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

  var message = {
    component: 'user-data',
    message: user
  };

  socket.nickname = rowCounter+' '+roomId;
  socket.join(roomId);

  rooms[roomId] = user;

  socket.emit('message',message);
}


function checkNumOfUsersInRoom(socket,role, roomId){
    // Check if room full
    // If first member in room then must be row counter
    // If second member then must be customer

    var clients = io.sockets.adapter.rooms[roomId];
    var clientToSendTo;
    var message;

    console.log('clients');
    console.log(clients);

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

//////////////////////////////////////////////////////////////////////////////////////////

http.listen(8080, '127.0.0.1', () => {
  console.log('started on port 8080');
});
