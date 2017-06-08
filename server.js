'use strict';

let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io')(http);
var roomIdsOccupied = [];

io.on('connection', (socket) => {
  console.log('USER CONNECTED');

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);

    socket.on('add-message', (message) => {
      io.in(roomId).emit('message', {type:'new-message', text: message});
    });

    socket.on('disconnect', function(){
      console.log('USER DISCONNECTED');
    });

  });
});

http.listen(8080, () => {
  console.log('started on port 8080');
});
