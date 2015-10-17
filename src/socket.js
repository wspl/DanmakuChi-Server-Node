import SocketIO from 'socket.io';
import Config from './config';

const io = SocketIO(Config.socket.listenPort);

io.on('connection', function (socket) {
  socket.on('channel', (channel) => {
    console.log(channel.toLowerCase());
    process.on('message', (data) => {
      if (data.type === 'CHANNEL_ISEXIST') {
        if (data.isExist) {
          socket.emit('channel', 'ok');
        } else {
          socket.emit('channel', 'no');
        }
      } else if (data.type === 'DANMAKU_SEND') {
        socket.emit(channel, data.body);
      }
    });
    process.send({
      type: 'CHANNEL_ISEXIST',
      channel: channel.toLowerCase()
    });
  });
});
