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
        channelSession[channel].forEach((ws ,i) => {
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
