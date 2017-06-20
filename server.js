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

// Mock users
// global users = [];

//Need a way to know which is pc and which is tablet in a room;
const rowCounter = 'RowCounter';
const customer = 'Customer';

const noRoom = 'No room with the roomId';
const roomFull = 'Full';

// Use promise
io.on('connection', (socket) => {
  console.log('USER CONNECTED');

  socket.on('message', (message) => {
    if(message.component === 'login'){
      var role = message.message.role;
      var username = message.message.username;
      var password = message.message.password;

      pool.getConnection((error,connection) => {
        if(error){
          console.log('there is an error to the database connection');
          return ;
        }else{
          var query = 'SELECT Id, FirstName, LastName, Position, Location FROM Users WHERE Username = ? AND Password = ?';
          var values = [username,password];
          var statement = mysql.format(query,values);

          connection.query(statement,(error,rows) => {
            if(error){
              console.log('error querying');
            }else{
              message = {
                component: 'user-data',
                message: {
                  id: rows[0].id,
                  firstname: rows[0].firstname,
                  lastname: rows[0].lastname,
                  position: rows[0].position,
                  location: rows[0].location
                }
              };

            }
          });
        }
      });
    }else if(message.component === 'joinRoom'){
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

function checkNumOfUsersInRoom(socket,role, roomId){
    // Check if room full
    // If first member in room then must be row counter
    // If second member then must be customer
    var clients = io.sockets.adapter.rooms[roomId];
    var clientToSendTo;
    var message;

    if(typeof clients === 'undefined' && role === rowCounter){
      socket.nickname = rowCounter;
      socket.join(roomId);

    }else if(role === customer && typeof clients !== 'undefined' && Object.keys(clients.sockets).length < 2){
      socket.nickname = customer;
      socket.join(roomId);

      var clients = io.sockets.adapter.rooms[roomId].sockets;
      var rowCounterId = Object.keys(clients)[0];
      var customerId = Object.keys(clients)[1];

      setClientToSendTo(socket,rowCounterId);
      setClientToSendTo(socket.broadcast.to(rowCounterId),customerId);

    }else if(role === customer && typeof clients === 'undefined'){
      sendRoomStatus(socket,noRoom);
      socket.disconnect();
    }else{
      sendRoomStatus(socket,roomFull);
      socket.disconnect();
    }
}

function setClientToSendTo(socket,idToSend){
  message = {
    component: 'setClientToSendTo',
    message: idToSend
  };
  socket.emit('message',message);
}

function sendRoomStatus(socket,status){
  message = {
    component: 'getRoomStatus',
    message: status
  };
  socket.emit('message',message);
}

http.listen(8080, '192.168.1.182', () => {
  console.log('started on port 8080');
});
