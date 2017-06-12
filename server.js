'use strict';

let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io')(http);


//Need a way to know which is pc and which is tablet in a room;
const rowCounter = 'RowCounter';
const customer = 'Customer';

const roomFull = 'Full';
var rooms = [];

io.on('connection', (socket) => {
  console.log('USER CONNECTED');
  console.log(socket.id);

  socket.on('joinRoom', (roomId) => {

    // Check if room full
    // If first member in room then must be row counter
    // If second member then must be customer
    var clients = io.sockets.adapter.rooms[roomId];
    var clientToSendTo;

    if(typeof clients === 'undefined'){
      socket.nickname = rowCounter;
      socket.join(roomId);
      socket.emit('setRole',rowCounter);
    }else if(Object.keys(clients.sockets).length < 2){
      socket.nickname = customer;
      socket.join(roomId);
      socket.emit('setRole',customer);

      var clients = io.sockets.adapter.rooms[roomId].sockets;
      var rowCounterId = Object.keys(clients)[0];
      var customerId = Object.keys(clients)[1];

      socket.emit('setClientToSendTo',rowCounterId);
      socket.broadcast.to(rowCounterId).emit('setClientToSendTo',customerId);
    }else{
      socket.emit('getRoomStatus',roomFull);
      socket.disconnect();
    }

    // io.in(roomId).emit('setRole',rowCounter);

    // socket.broadcast.to(roomId).emit()
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

http.listen(8080, () => {
  console.log('started on port 8080');
});
