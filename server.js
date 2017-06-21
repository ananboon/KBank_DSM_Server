'use strict';
let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io')(http);
let mysql = require('mysql');
let Promise = require('bluebird');


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


global.rooms = [];

const rowCounter = 'RowCounter';
const customer = 'Customer';

const noRoom = 'No room with the roomId';
const roomFull = 'Full';

////////////////////////////////////////////////////////////////////////////////////////////

io.on('connection', (socket) => {
  console.log('USER CONNECTED');

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
    }else{
      socket.broadcast.to(message.clientId).emit('message',message);
    }
  });

  socket.on('disconnect', ()=> {

    console.log('User disconnected');
  });
});

////////////////////////////////////////////////////////////////////////////////////////////

function errorHandler(socket,error){
  console.log(error);
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

  socket.nickname = rowCounter;
  socket.join(roomId);
  rooms[roomId] = user;

  console.log(rooms[roomId]);

  socket.emit('message',message);
}


function checkNumOfUsersInRoom(socket,role, roomId){
    // Check if room full
    // If first member in room then must be row counter
    // If second member then must be customer

    var clients = io.sockets.adapter.rooms[roomId];
    var clientToSendTo;
    var message;

    if(role === customer && typeof clients !== 'undefined' && Object.keys(clients.sockets).length < 2){
      socket.nickname = customer;
      socket.join(roomId);

      var clients = io.sockets.adapter.rooms[roomId].sockets;
      var rowCounterId = Object.keys(clients)[0];
      var customerId = Object.keys(clients)[1];

      setClientToSendTo(socket,rowCounterId);
      setClientToSendTo(socket.broadcast.to(rowCounterId),customerId);

    }else if(role === customer && typeof clients === 'undefined'){
      sendRoomStatus(socket,noRoom);
      // io.sockets.sockets[socket.id].disconnect();
    }else{
      sendRoomStatus(socket,roomFull);
      // io.sockets.sockets[socket.id].disconnect();
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

//////////////////////////////////////////////////////////////////////////////////////////

http.listen(8080, '127.0.0.1', () => {
  console.log('started on port 8080');
});
