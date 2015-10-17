import Express from 'express';
import childProcess from 'child_process';
import Wechat from './wechat';
import Config from './config';

const app = new Express();
const socketServer = childProcess.fork('entries/entry_socket');

app.get('/', function (req, res) {
  res.end('test');
});

app.use('/wechat_api', Wechat(socketServer));

app.listen(Config.web.listenPort, () => {
  console.log('Server is running...');
});
