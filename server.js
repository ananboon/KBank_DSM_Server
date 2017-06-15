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

//Need a way to know which is pc and which is tablet in a room;
const rowCounter = 'RowCounter';
const customer = 'Customer';

const noRoom = 'No room with the roomId';
const roomFull = 'Full';
var rooms = [];

io.on('connection', (socket) => {
  console.log('USER CONNECTED');
  console.log(socket.id);

  socket.on('joinRoom', (role,roomId) => {

    // Check if room full
    // If first member in room then must be row counter
    // If second member then must be customer
    var clients = io.sockets.adapter.rooms[roomId];
    var clientToSendTo;

    // Object.keys(clients.sockets).length < 2
    console.log(typeof role);
    console.log(role);

    if(typeof clients === 'undefined' && role === rowCounter){
      socket.nickname = rowCounter;
      socket.join(roomId);

    }else if(role === customer && typeof clients !== 'undefined' && Object.keys(clients.sockets).length < 2){
      socket.nickname = customer;
      socket.join(roomId);

      var clients = io.sockets.adapter.rooms[roomId].sockets;
      var rowCounterId = Object.keys(clients)[0];
      var customerId = Object.keys(clients)[1];

      socket.emit('setClientToSendTo',rowCounterId);
      socket.broadcast.to(rowCounterId).emit('setClientToSendTo',customerId);
    }else if(role === customer && typeof clients === 'undefined'){
      console.log('invalid room');
      socket.emit('getRoomStatus',noRoom);
      socket.disconnect();
    }else{
      console.log('room full');
      socket.emit('getRoomStatus',roomFull);
      socket.disconnect();
    }

    ///////////////////////////////////////////////////////////////////////////

    socket.on('message', (clientToSendToId,message) => {
      socket.broadcast.to(clientToSendToId).emit('message',message);
    });

    socket.on('disconnect', function(){
      console.log('USER DISCONNECTED');
    });

    ///////////////////////////////////////////////////////////////////////////
  });
});

http.listen(8080, '192.168.1.178', () => {
  console.log('started on port 8080');
});
