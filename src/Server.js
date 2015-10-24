import Express from 'express';
import ExpressWebSocket from 'express-ws';
import childProcess from 'child_process';
import Wechat from './Wechat';
import Config from './Config';
import { SocketProxy, SocketMiddleware } from './Socket';

const app = new Express();

ExpressWebSocket(app);

app.get('/', function (req, res) {
  res.end('test');
});

let socketProxy = SocketProxy();

app.use('/wechat_api', Wechat(socketProxy));
app.ws('/ws', SocketMiddleware(socketProxy));

app.listen(Config.web.listenPort, () => {
  console.log('Server is running...');
});
