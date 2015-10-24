import WechatAPI from 'wechat-api';

const api = new WechatAPI('wxa011ca5f473ba520', 'bf6adb94a5e99d57852fc609855518ff');
const menu = {
  "button": [
    {
      "name": "使用帮助",
      "sub_button": [
        {
          "type": "click",
          "name": "指令大全",
          "key": "HELP_OTHER_COMMAND"
        }, {
          "type": "click",
          "name": "我要创建频道",
          "key": "HELP_CREATE_CHANNEL"
        }, {
          "type": "click",
          "name": "如何发高级弹幕",
          "key": "HELP_ADVANCED_DANMAKU"
        }
      ]
    }, {
      "name": "我的频道",
      "sub_button": [
        {
          "type": "scancode_waitmsg",
          "name": "扫描二维码加入",
          "key": "QRCODE_JOIN_CHANNEL"
        }, {
          "type": "click",
          "name": "输入频道名加入",
          "key": "ACTION_JOIN_CHANNEL"
        }, {
          "type": "click",
          "name": "退出当前频道",
          "key": "ACTION_EXIT_CHANNEL"
        }
      ]
    }
  ]
}
//api.getMaterials('news', 0, 20, (err, result) => {
//  console.log(err, result);
//});

api.createMenu(menu, (err, result) => {
  console.log(err, result);
});
