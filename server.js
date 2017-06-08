'use strict';

let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io')(http);


//Need a way to know which is pc and which is tablet in a room;

io.on('connection', (socket) => {
  console.log('USER CONNECTED');
  console.log(socket.id);

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
