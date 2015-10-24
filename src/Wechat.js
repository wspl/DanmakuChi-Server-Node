import Wechat from 'wechat'
import querystring from 'querystring';
import url from 'url';

import Config from './Config';
import { commands, messages } from './WechatAssets';
import {
  Session,
  ChannelSession,
  HoldingSession,
  CleanSession,
  JoinChannel,
  CreateChannel,
  ExitChannel,
  RemoveChannel,
  RenewChannel,
  SocketManager
} from './Channel';

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
      // QRCode Body Example:
      // http://weixin.qq.com/r/<qrcodeToken>?dmk_channel=<channel>
      const body = weixin.ScanCodeInfo.ScanResult;
      const channel = querystring.parse(url.parse(body).query)['dmk_channel'];
      if (channel) {
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

export default function (socketProxy) {
  const sm = SocketManager(socketProxy);
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
