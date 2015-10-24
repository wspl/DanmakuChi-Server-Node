import Config from './Config';

let channelSession = {};

export function SocketMiddleware(sp) {
  return (ws, req) => {
    const channel = req.query['channel'];
    sp().isExist(channel, (err, isExist) => {
      if (isExist) {
        if (!channelSession[channel]) channelSession[channel] = [];
        channelSession[channel].push(ws);
        ws.send('INFO:OK');
      } else {
        ws.send('INFO:NOT_EXIST');
      }
    });
  }
}

export function SocketProxy() {
  let _methods = {
    send: (channel, body) => {
      if (channelSession[channel] && channelSession[channel].length > 0) {
        channelSession[channel].forEach((ws) => {
          try {
            ws.send('DANMAKU:' + body);
          } catch (e) {}
        });
      }
    }
  };
  return () => {
    return {
      addMethods: (methods) => {
        _methods = {...methods, ..._methods};
      },
      ... _methods
    };
  }
}


/*
const io = SocketIO(Config.socket.listenPort);

io.on('connection', function (socket) {
  socket.on('channel', (channel) => {
    //console.log(channel.toLowerCase());
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
*/
