import "./mqttws31";
var mqttSub = [];
var isLoginOut;
let client = null;
let tempSub = [];
let interval = null;
let isConnect = false;
let connectInterval = null;

function initMqtt(sub, userId, extraParams) {
	const globalData = getApp().globalData
  if(client) {
    client.disconnect();
    client = {};
  }
  client = new Paho.MQTT.Client(
    globalData.MQTT_URL,
    Number(globalData.MQTT_PORT),
    "/ws",
    "myid_" + userId
  );

  var options = {
    userName: globalData.MQTT_ACCOUNT,
    password: globalData.MQTT_PASSWORD,
    timeout: 3,
    keepAliveInterval: 10,
    useSSL: true,
    reconnect: true,
    // 连接失败
    onFailure: function (message) {
      isConnect = false;
      localStorage.setItem("mqttStatus", false);
      console.log("[mqtt]连接失败", message);
      connectInterval = setInterval(() => {
        if (isConnect) {
          clearInterval(connectInterval);
        } else {
          client.connect({
            userName: globalData.MQTT_ACCOUNT,
            password: globalData.MQTT_PASSWORD,
            timeout: 3,
            keepAliveInterval: 3,
            useSSL: true,
            reconnect: true,
            onFailure: function (message) {
              console.log("[mqtt]重新连接失败", message);
            },
          });
        }
      }, 5000);
    },
  };
  client.onConnected = function () {
    console.log("连接成功", mqttSub);
    isConnect = true;
    localStorage.setItem("mqttStatus", true);
    if (mqttSub.length > 0) {
      reSubscribeAll(extraParams);
    } else {
      subscribe(sub, extraParams);
    }
  };
  // 监听连接丢失状态
  client.onConnectionLost = function (responseObject) {
    console.log("[mqtt]连接丢失");
    isConnect = false;
    localStorage.setItem("mqttStatus", false);
  };
  client.connect(options);
  // 接收信息
  client.onMessageArrived = onMessageArrived;
}

//接收消息
function onMessageArrived(e) {
  console.log("[mqtt]收到信息", e);
  let obj = JSON.parse(e.payloadString);
  // 收到服务器心跳返回信息，心跳重置
  if (obj.code == "pong") {
    console.log("[mqtt]心跳");
    lockReconnect = true;
    // reset();
    //如果是单纯的心跳包，就不往下执行了
    return;
  } else if (obj.code == "loginOut") {
    isLoginOut = "loginout";
    loginOutMqttMessage(obj);
    console.log("[mqtt]数据结构有问题");
  }
  console.log("[mqtt]转换后的数据", obj);
  const result = mqttSub.find((item) => item.topic === obj.topic);
  if (result && result.callback) {
    result.callback(obj);
  }
}

// 发送消息
function send(msg, topic) {
  console.log("[mqtt]发送信息", JSON.parse(msg));
  let message = new Paho.MQTT.Message(msg);
  message.destinationName = topic;
  client.send(message);
}

function reSubscribeAll(extraParams) {
  mqttSub.forEach((item) => {
    client.subscribe(item.topic, { qos: 1 });
    console.log("[mqtt]重新订阅成功", item.topic);
  });
  if (extraParams && extraParams.subscribeCallback) {
    extraParams.subscribeCallback();
  }
}

//订阅消息
function subscribe(topic, extraParams) {
  if (isConnect) {
    if (mqttSub.find((item) => item.topic === topic)) {
      console.log("[mqtt]已存在此订阅", topic);
      if (extraParams && extraParams.subscribeCallback) {
        extraParams.subscribeCallback();
      }
    } else {
      mqttSub.push({
        topic,
        callback: extraParams ? extraParams.callback : null,
      });
      client.subscribe(topic, { qos: 1 });
      if (extraParams && extraParams.subscribeCallback) {
        extraParams.subscribeCallback();
      }
      console.log("[mqtt]", topic, "订阅成功");
    }
  } else {
    tempSub.push({
      topic,
      extraParams,
    });
    clearInterval(interval);
    let interval = setInterval(() => {
      if (isConnect) {
        tempSub.forEach((item) => {
          subscribe(item.topic, item.extraParams);
        });
        tempSub = [];
        clearInterval(interval);
      }
    }, 10);
  }
}

//退出登录
function shutDownMqtt() {
  clearInterval(interval);
  mqttSub.forEach((item) => {
    client.unsubscribe(item.topic);
  });
  client.disconnect();
  client = {};
  isConnect = false;
  console.log("[mqtt]彻底关闭mqtt----------");
}

function unsubscribe(topic) {
  if (client) {
    client.unsubscribe(topic);
    const index = mqttSub.findIndex((item) => item.topic === topic);
    if (index >= 0) {
      mqttSub.splice(index, 1);
    }
    console.log("[mqtt]取消订阅", topic);
  }
}

export { initMqtt, send, subscribe, shutDownMqtt, unsubscribe };
