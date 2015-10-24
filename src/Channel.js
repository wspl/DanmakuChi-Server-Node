import Redis from 'redis';
import md5 from 'md5';

import Config from './Config';

const redis = Redis.createClient();

const prefix = Config.db.prefix;

const keys = {
  session: user => `${prefix}SESSION:${user}`,
  channel: (channel, md5ed) => `${prefix}CHANNEL:${md5ed ? channel : md5(channel)}`
};

export function Session(user, callback) {
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

export function ChannelSession(user, channel) {
  redis.set(keys.session(user), JSON.stringify({
    channel: channel
  }));
}

export function HoldingSession(user, event) {
  redis.set(keys.session(user), JSON.stringify({
    holding: event
  }));
}

export function CleanSession(user) {
  redis.del(keys.session(user));
}

export function JoinChannel(channel, user, callback) {
  redis.get(keys.channel(channel), (err, rs) => {
    if (rs) {
      ChannelSession(user, channel);
      callback(err, 'CHANNEL_ENTERED');
    } else {
      callback(err, 'CHANNEL_NOTEXIST');
    }
  });
}

export function CreateChannel(channel, user, callback) {
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

export function ExitChannel(user, callback) {
  Session(user, (err, session) => {
    if (session.channel) {
      CleanSession(user);
      callback(null, 'CHANNEL_EXITED', session.channel);
    } else {
      callback(null, 'SESSION_EMPTY');
    }
  })
}

export function RemoveChannel(channel, user, callback) {
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

export function RenewChannel(channel, user, callback) {
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

export function SocketManager(sp) {
  sp().addMethods({
    isExist: (channel, callback) => {
      redis.get(keys.channel(channel), (err, rs) => {
        if (rs) callback(err, true);
        else callback(err, false);
      });
    }
  })
  return {
    send: (channel, body) => {
      sp().send(channel, body);
    }
  }
  /*
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
  };*/
}
