import Wechat from 'wechat'
import Redis from 'redis';
import md5 from 'md5';

import Config from './config';

const redis = Redis.createClient();
const prefix = Config.db.prefix;

const commands = new Map([
  ['CHANNEL_CREATE', ['创建频道']],
  ['CHANNEL_REMOVE', ['删除频道', '取消频道']],
  ['CHANNEL_RENEW', ['频道续期']],
  ['CHANNEL_ENTER', ['进入频道']],
  ['CHANNEL_EXIT', ['断开频道', '退出频道', '离开频道']]
]);

const messages = {
  'HELLO':
`欢迎使用「上师大弹幕姬」，以下是基本命令：

1) 连接频道：进入频道XXX
2) 离开频道：离开频道XXX
3) 进入频道后，发出去的信息就是弹幕了

你也可以通过菜单栏了解更高级的命令与如何创建一个自己的频道。`,
 'CHANNEL_ENTERED': '你已经成功进入了「{}」频道，接下来就可以在这个频道里发布弹幕啦！',
 'CHANNEL_EXITED': '你已离开「{}」频道',
 'CHANNEL_NOTEXIST': '找不到「{}」频道',
 'COMMAND_UNKNOWN': '不知道有这个指令…你可以通过菜单栏了解弹幕姬能够看懂哪些命令哦。',
 'CHANNEL_CREATED': '已经成功创建了「{}」频道，有效期 12 小时，作为该频道主人的你也可以通过「删除频道XXX」命令来删除这个频道哦。',
 'CHANNEL_REMOVED': '已经成功删除了「{}」频道！',
 'CHANNEL_REPEATED': '发现了另外一个同样也叫做「{}」的频道，不能重复创建这个频道了。',
 'CHANNEL_NOTBELONG': '你没有权利操作这个频道哦。',
 'CHANNEL_RENEWED': '你已经成功给这个频道续了 12 小时的时间。',
 'SESSION_EMPTY': '你不在任何频道中哦',
 'GENERAL_INVALID': '你的这个操作弹幕姬理解不能',
 'DANMAKU_SENT': '弹幕发射成功',
 'ACTION_JOIN_CHANNEL': '请输入你想要加入的频道名称',
 'HELP_OTHER_COMMAND':
`「上师大弹幕姬」的高级命令

1) 进入一个频道
「进入频道<频道名>」
2) 退出目前所在的频道
「离开频道」
3) 创建一个新频道
「创建频道<频道名>」
4) 删除一个自己创建的频道
「删除频道<频道名>」
5) 给自己创建的一个频道续期 12 小时
「频道续期<频道名>」

例如：
你如果想要创建一个叫「二次元晚会」的频道，就输入：创建频道二次元晚会`,
 'HELP_CREATE_CHANNEL':
`创建频道指南

待完成`,
 'HELP_ADVANCED_DANMAKU':
`「上师大弹幕姬」高级弹幕帮助


`,
 'QRCODE_INVALID': '这个二维码弹幕姬识别不了哦'
};

const keys = {
  session: user => `${prefix}SESSION:${user}`,
  channel: (channel, md5ed) => `${prefix}CHANNEL:${md5ed ? channel : md5(channel)}`
};

function Session(user, callback) {
  redis.get(keys.session(user), (err, rs) => {
    if (rs) {
      const session = JSON.parse(rs);
      callback(null, session);
    } else {
      callback(null, {
        free: 1
      });
    }
  });
}

function ChannelSession(user, channel) {
  redis.set(keys.session(user), JSON.stringify({
    channel: channel
  }));
}

function HoldingSession(user, event) {
  redis.set(keys.session(user), JSON.stringify({
    holding: event
  }));
}

function CleanSession(user) {
  redis.del(keys.session(user));
}

function JoinChannel(channel, user, callback) {
  redis.get(keys.channel(channel), (err, rs) => {
    if (rs) {
      ChannelSession(user, channel);
      callback(err, 'CHANNEL_ENTERED');
    } else {
      callback(err, 'CHANNEL_NOTEXIST');
    }
  });
}

function CreateChannel(channel, user, callback) {
  redis.get(keys.channel(channel), (err, rs) => {
    if (!rs) {
      redis.set(keys.channel(channel), user);
      redis.expire(keys.channel(channel), 60 * 60 * 12);
      callback(err, 'CHANNEL_CREATED');
    } else {
      callback(err, 'CHANNEL_REPEATED');
    }
  });
}

function ExitChannel(user, callback) {
  Session(user, (err, session) => {
    if (session.channel) {
      CleanSession(user);
      callback(null, 'CHANNEL_EXITED', session.channel);
    } else {
      callback(null, 'SESSION_EMPTY');
    }
  })
}

function RemoveChannel(channel, user, callback) {
  redis.get(keys.channel(channel), (err, rs) => {
    if (!rs) {
      callback(err, 'CHANNEL_NOTEXIST');
    } else if (rs === user) {
      redis.del(keys.channel(channel));
      callback(err, 'CHANNEL_REMOVED');
    } else {
      callback(err, 'CHANNEL_NOTBELONG');
    }
  });
}

function RenewChannel(channel, user, callback) {
  redis.get(keys.channel(channel), (err, rs) => {
    if (!rs) {
      callback(err, 'CHANNEL_NOTEXIST');
    } else if (rs === user) {
      redis.expire(keys.channel(channel), 60 * 60 * 12);
      callback(err, 'CHANNEL_RENEWED');
    } else {
      callback(err, 'CHANNEL_NOTBELONG');
    }
  });
}

function trim(str) {
  return str.replace(/(^\s*)|(\s*$)/g, '');
}

function DanmakuMode(user, channel, body, res, sm) {
  let isExit = false;
  commands.get('CHANNEL_EXIT').forEach(kw => {
    if (body.indexOf(kw) === 0) {
      isExit = true;
      ExitChannel(user, (err, rs) => {
        if (err) throw err;
        res.reply(messages[rs].replace('{}', channel));
      });
    }
  });
  if (!isExit) {
    console.log(`${user} -> ${channel} : ${body}`);
    sm.send(channel, body);
    res.reply(messages['DANMAKU_SENT']);
  }
}

function CommandMode(user, body, res) {
  let action, keyword;
  // New Session
  commands.forEach((keywords, act) => {
    keywords.forEach(kw => {
      if (body.indexOf(kw) === 0) {
        [action, keyword] = [act, kw];
      }
    });
  });
  const channel = trim(body.replace(keyword, ''));
  const doResponse = (err, rs) => {
    if (err) throw err;
    res.reply(messages[rs].replace('{}', channel));
  }
  switch (action) {
    case 'CHANNEL_ENTER':
      JoinChannel(channel, user, doResponse);
      break;
    case 'CHANNEL_CREATE':
      CreateChannel(channel, user, doResponse);
      break;
    case 'CHANNEL_REMOVE':
      RemoveChannel(channel, user, doResponse);
      break;
    case 'CHANNEL_RENEW':
      RenewChannel(channel, user, doResponse);
      break;
    default:
      res.reply(messages['COMMAND_UNKNOWN']);
      break;
  }
}

function ResponseMode(user, holding, body, res) {
  CleanSession(user);
  switch (holding) {
    case 'ACTION_JOIN_CHANNEL':
      JoinChannel(body, user, (err, rs) => {
        if (err) throw err;
        res.reply(messages[rs].replace('{}', body));
      });
      break;
  }
}

function HandleMessage(weixin, res, sm) {
  const body = trim(weixin.Content);
  const user = weixin.FromUserName;
  if (body) {
    Session(user, (err, session) => {
      if (session.free) {
        CommandMode(user, body, res);
      } else if (session.channel) {
        DanmakuMode(user, session.channel, body, res, sm);
      } else if (session.holding) {
        ResponseMode(user, session.holding, body, res);
      } else {
        res.reply(messages['GENERAL_INVALID']);
      }
    })
  } else {
    res.reply(messages['GENERAL_INVALID']);
  }
}

function HandleEvent(weixin, res) {
  const user = weixin.FromUserName;
  switch (weixin.EventKey) {
    case 'QRCODE_JOIN_CHANNEL':
      //QRCode Content Example: dmk://channel/<channel_name>
      const body = weixin.ScanCodeInfo.ScanResult
      if (body.indexOf('dmk://channel/') === 0) {
        const channel = body.replace('dmk://channel/', '');
        JoinChannel(channel, user, (err, rs) => {
          if (err) throw err;
          res.reply(messages[rs].replace('{}', channel));
        });
      } else {
        res.reply(messages['QRCODE_INVALID']);
      }
      break;
    case 'ACTION_JOIN_CHANNEL':
      res.reply(messages[weixin.EventKey]);
      HoldingSession(user, weixin.EventKey);
      break;
    case 'ACTION_EXIT_CHANNEL':
      ExitChannel(user, (err, rs, channel) => {
        if (err) throw err;
        res.reply(messages[rs].replace('{}', channel));
      })
      break;
    case 'HELP_OTHER_COMMAND':
    case 'HELP_CREATE_CHANNEL':
    case 'HELP_ADVANCED_DANMAKU':
      res.reply(messages[weixin.EventKey]);
      break;
  }
}

function SocketManager(ss) {
  ss.on('message', (data) => {
    if (data.type === 'CHANNEL_ISEXIST')
      redis.get(keys.channel(data.channel, true), (err, rs) => {
        if (rs) ss.send({ type: data.type, isExist: true });
        else ss.send({ type: data.type, isExist: false });
      });
  });
  return {
    send: (channel, body) => {
      ss.send({
        type: 'DANMAKU_SEND',
        channel: channel,
        body: body
      });
    }
  };
}

export default function (socketServer) {
  const sm = SocketManager(socketServer);
  return Wechat(Config.wechat, (req, res, next) => {
    const weixin = req.weixin;
    switch (weixin.MsgType) {
      case 'text':
        HandleMessage(weixin, res, sm);
        break;
      case 'event':
        HandleEvent(weixin, res);
        break;
      default:
        res.reply(messages['GENERAL_INVALID']);
        break;
    }
  })
};
