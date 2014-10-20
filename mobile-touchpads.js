#!/usr/bin/env node

var http = require('http');
var path = require('path');
var url = require('url');
var ws = require('ws');
var os = require('os');
var fs = require('fs');

var port = 7550;

////////////////////////////////////////////////////////////////////////////////
// The script that implements the API
////////////////////////////////////////////////////////////////////////////////

var scriptSource = [
  '(',
  function() {
    function changeStatus(text) {
      touchpads.status = text;
      if (touchpads.onstatuschange) {
        touchpads.onstatuschange();
      }
    }

    function connect() {
      socket = new WebSocket('ws://' + location.hostname + ':' + PORT);
      socket.binaryType = 'arraybuffer';
      changeStatus('Connecting...');

      socket.onmessage = function(e) {
        var data = new Int16Array(e.data);
        var next = 0;
        touchpads.devices = [];
        while (next < data.length) {
          var device = {};
          var size = data[next++] / 4 - 1;
          device.width = data[next++];
          device.height = data[next++];
          device.touches = [];
          for (var i = 0; i < size; i++) {
            device.touches.push({
              x: data[next++],
              y: data[next++]
            });
          }
          touchpads.devices.push(device);
        }
        if (touchpads.onupdate) {
          touchpads.onupdate();
        }
      };

      socket.onopen = function(e) {
        changeStatus('Connected');
        socket.send('script.js');
      };

      socket.onclose = function(e) {
        changeStatus('Disconnected');
        setTimeout(connect, 500);
      };
    }

    var touchpads = {
      status: '',
      onstatuschange: null,
      devices: [],
      onupdate: null,
    };
    var socket = null;

    connect();
    window.touchpads = touchpads;
  },
  ')()',
].join('\n').replace(/\bPORT\b/g, port);

////////////////////////////////////////////////////////////////////////////////
// The page that sends touches
////////////////////////////////////////////////////////////////////////////////

var pageSource = [
  '<html>',
  '<head>',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="viewport" content="minimal-ui">',
  '<meta name="viewport" content="initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no">',
  '<style>',
  '',
  'body {',
  '  color: white;',
  '  background: black;',
  '  font: 12px sans-serif;',
  '}',
  '',
  '#top, #bottom {',
  '  position: absolute;',
  '  left: 20px;',
  '  right: 20px;',
  '  text-align: center;',
  '  z-index: 1;',
  '}',
  '',
  '#top {',
  '  top: 20px;',
  '}',
  '',
  '#bottom {',
  '  bottom: 20px;',
  '}',
  '',
  'canvas {',
  '  position: absolute;',
  '  left: 0;',
  '  top: 0;',
  '}',
  '',
  '</style>',
  '<script>(',
  function() {
    document.write('<title>' + location.hostname + '</title>');

    // Generate an icon for the iPhone home page
    if (navigator.userAgent.match(/\bMobile\b/) && navigator.userAgent.match(/\bSafari\b/)) {
      function circle(center, radius, color) {
        c.fillStyle = color;
        c.beginPath();
        c.arc(center.x, center.y, radius, 0, Math.PI * 2, false);
        c.fill();
      }
      var c = document.createElement('canvas').getContext('2d');
      var size = c.canvas.width = c.canvas.height = 256;
      c.fillRect(0, 0, size, size);
      var points = [{ x: 160, y: 64 }, { x: 64, y: 128 }, { x: 192, y: 192 }];
      c.strokeStyle = '#FFF';
      c.lineWidth = 8;
      c.beginPath();
      for (var i = 0; i < points.length; i++) {
        var a = points[i];
        for (var j = i + 1; j < points.length; j++) {
          var b = points[j];
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
        }
      }
      c.stroke();
      for (var i = 0; i < points.length; i++) circle(points[i], 32, '#FFF');
      for (var i = 0; i < points.length; i++) circle(points[i], 24, '#000');
      document.write('<link rel="apple-touch-icon" href="' + c.canvas.toDataURL() + '">');
    }
  },
  ')();',
  '</script>',
  '</head>',
  '<body>',
  '<div id="top"></div>',
  '<div id="bottom"></div>',
  '<script>(',
  function() {
    function installed() {
      function render() {
        needsRender = false;
        context.clearRect(0, 0, width, height);

        // Lines
        context.strokeStyle = '#FFF';
        context.lineWidth = 5;
        context.beginPath();
        for (var i = 0; i < touches.length; i++) {
          var a = touches[i];
          for (var j = i + 1; j < touches.length; j++) {
            var b = touches[j];
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
          }
        }
        context.stroke();

        // Solid circles
        context.fillStyle = '#FFF';
        for (var i = 0; i < touches.length; i++) {
          var touch = touches[i];
          context.beginPath();
          context.arc(touch.x, touch.y, 50, 0, Math.PI * 2, false);
          context.fill();
        }

        // Empty circles
        context.fillStyle = '#000';
        for (var i = 0; i < touches.length; i++) {
          var touch = touches[i];
          context.beginPath();
          context.arc(touch.x, touch.y, 40, 0, Math.PI * 2, false);
          context.fill();
        }
      }

      function tick() {
        if (needsRender) {
          render();
        }

        // Send gesture updates at 30hz
        if (frameCount % 2 === 0) {
          var data = new Int16Array(2 + touches.length * 2);
          data[0] = width;
          data[1] = height;
          for (var i = 0; i < touches.length; i++) {
            var touch = touches[i];
            data[2 + i * 2] = touch.x;
            data[2 + i * 2 + 1] = touch.y;
          }
          try {
            socket.send(data.buffer);
          } catch (e) {
          }
        }

        frameCount++;
        requestAnimationFrame(tick);
      }

      function connect() {
        socket = new WebSocket('ws://' + location.host);
        status.textContent = 'Connecting...';
        socket.onopen = function(e) {
          status.textContent = 'Connected';
        };
        socket.onclose = function(e) {
          status.textContent = 'Disconnected';
          setTimeout(connect, 500);
        };
      }

      window.onresize = function() {
        var ratio = window.devicePixelRatio || 1;
        width = innerWidth;
        height = innerHeight;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        context.scale(canvas.width / width, canvas.height / height);
        render();
      };

      document.ontouchstart = document.ontouchmove = document.ontouchend = document.ontouchcancel = function(e) {
        needsRender = true;
        touches = Array.prototype.map.call(e.touches, function(touch) {
          return { x: touch.pageX, y: touch.pageY };
        });
        e.preventDefault();
      };

      var status = document.getElementById('top');
      var socket = null;
      var needsRender = false;
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      var width = 0;
      var height = 0;
      var touches = [];
      var frameCount = 0;

      connect();
      window.onresize();
      requestAnimationFrame(tick);
      document.body.appendChild(canvas);
    }

    function uninstalled() {
      if (navigator.userAgent.match(/\bMobile\b/) && navigator.userAgent.match(/\bSafari\b/)) {
        var instructions = document.getElementById('bottom');
        instructions.innerHTML =
          'Please add this to the home screen, which will hide the browser interface and prevents accidental taps' +
          '<div style="margin-top:20px;font-size:50px;">&darr;</div>';
      } else {
        var instructions = document.getElementById('top');
        instructions.innerHTML = 'Please visit this page on an iPhone';
      }
    }

    if (navigator.standalone) installed();
    else uninstalled();
  },
  ')();',
  '</script>',
  '</body>',
  '</html>',
].join('\n');

////////////////////////////////////////////////////////////////////////////////
// Network interface add/remove monitoring
////////////////////////////////////////////////////////////////////////////////

var networkInterfaces = new (require('events').EventEmitter);
networkInterfaces.all = [];
setInterval(function() {
  var map = os.networkInterfaces();
  var list = [];

  // Extract interfaces
  for (var name in map) {
    var addresses = map[name];
    for (var i = 0; i < addresses.length; i++) {
      var data = addresses[i];
      if (data.family === 'IPv4') {
        list.push(data.address);
      }
    }
  }

  // Remove old interfaces
  for (var i = 0; i < networkInterfaces.all.length; i++) {
    var address = networkInterfaces.all[i];
    if (list.indexOf(address) < 0) {
      networkInterfaces.all.splice(i--, 1);
      networkInterfaces.emit('remove', address);
    }
  }

  // Add new interfaces
  for (var i = 0; i < list.length; i++) {
    var address = list[i];
    if (networkInterfaces.all.indexOf(address) < 0) {
      networkInterfaces.all.push(address);
      networkInterfaces.emit('add', address);
    }
  }
}, 500);

////////////////////////////////////////////////////////////////////////////////
// Entry point
////////////////////////////////////////////////////////////////////////////////

var closeServer = {};
var touchpads = {};
var scriptClients = {};
var touchpadClients = {};
var nextClientID = 0;

function serverHandler(request, response) {
  if (request.method === 'GET' && request.url === '/') {
    console.log('200 ' + request.url);
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(pageSource);
  }

  else if (request.method === 'GET' && request.url === '/script.js') {
    console.log('200 ' + request.url);
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    response.end(scriptSource);
  }

  else {
    console.log('404 ' + request.url);
    response.writeHead(404);
    response.end('404 not found');
  }
}

function bufferFromInt16(value) {
  return new Buffer(new Uint8Array(new Int16Array([value]).buffer));
}

function notifyAllClients() {
  var messages = [];
  for (var name in touchpadClients) {
    messages.push(touchpadClients[name]);
  }
  var buffer = Buffer.concat(messages);
  for (var name in scriptClients) {
    try { scriptClients[name].send(buffer); } catch (e) {} // This crashes sometimes complaining about a closed connection
  }
}

function socketServerHandler(socket) {
  var address = socket._socket.remoteAddress + ':' + socket._socket.remotePort;
  var id = nextClientID++;
  console.log('connected ' + address);
  socket.on('message', function(message) {
    if (message === 'script.js') {
      scriptClients[id] = socket;
      notifyAllClients();
    } else {
      touchpadClients[id] = Buffer.concat([bufferFromInt16(message.length), new Buffer(message)]);
      notifyAllClients();
    }
  });
  socket.on('close', function() {
    console.log('disconnected ' + address);
    delete scriptClients[id];
    delete touchpadClients[id];
    notifyAllClients();
  });
}

networkInterfaces.on('add', function(address) {
  var name = 'http://' + address + ':' + port + '/';
  var isNeeded = true;
  var server = http.createServer(serverHandler);
  server.listen(port, address, function() {
    if (!isNeeded) {
      server.close();
      return;
    }
    var socketServer = new ws.Server({ server: server });
    console.log('added ' + name);
    closeServer[address] = function() {
      socketServer.close();
      server.close();
    };
    socketServer.on('connection', socketServerHandler);
  });
  server.on('close', function() {
    console.log('removed ' + name);
  });
  closeServer[address] = function() {
    isNeeded = false;
  };
});

networkInterfaces.on('remove', function(address) {
  if (address in closeServer) {
    closeServer[address]();
    delete closeServer[address];
  }
});
