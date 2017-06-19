'use strict';

let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io')(http);


// Need to change to Sessions
// _global.ses = {
//   users:[
//     {
//       "id":"user1"
//     }
//   ]
// }

//Need global users

//Need a way to know which is pc and which is tablet in a room;
const rowCounter = 'RowCounter';
const customer = 'Customer';

const noRoom = 'No room with the roomId';
const roomFull = 'Full';
var rooms = [];

// Use promise


io.on('connection', (socket) => {
  console.log('USER CONNECTED');



  socket.on('message', (message) => {
    if(message.component == 'joinRoom'){
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
      console.log('invalid room');

      sendRoomStatus(socket,noRoom);
      socket.disconnect();
    }else{
      console.log('room full');

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

http.listen(8080, '172.20.10.4', () => {
  console.log('started on port 8080');
});
