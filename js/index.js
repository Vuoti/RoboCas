var config = {
  returnSpeed: 0.4
};

function r2d(r) {
  return 180 / Math.PI * r;
}

function random(min, max) {
  return min + (max - min) * Math.random();
}

/**
* Eye model object
* -----------------------------
*/
function Eye(sel) {
  // dom
  this.eye = document.querySelector(sel);
  this.pupil = this.eye.children[0];
  this.lid = this.eye.children[1];

  // widths
  this.ew = this.eye.offsetWidth;
  this.pw = this.pupil.offsetWidth;

  // centered position
  this.cx = this.eye.getBoundingClientRect().right - this.ew/2;
  this.cy = this.eye.getBoundingClientRect().bottom - this.ew/2;

  // state
  this.bLidUp = true;
}

Eye.prototype.movePupil = function(r, theta) {
  var x, y;

  if (r > 1) r = 1; // clamp
  r *= (this.ew/2 - this.pw/2); // restrict edge of pupil to edge of eye

  // convert polar to rectangular
  x = r * Math.cos(theta) + (this.ew - this.pw)/2;
  y = r * Math.sin(theta) + (this.ew - this.pw)/2;

  this.pupil.style.transform = 'translateX(' + x + 'px)' +
                                'translateY(' + y + 'px)' +
                                'rotate(-45deg)';
}

Eye.prototype.blink = function() {
  if (this.bLidUp) {
    this.bLidUp = false;
    this.lid.style.transform = 'translateY(80%)';
  } else {
    this.bLidUp = true;
    this.lid.style.transform = 'translateY(0%)';
  }
}


/**
* pupil-mouse tracking and draw
* -----------------------------
*/
var leye = new Eye('.eye#left'),
    reye = new Eye('.eye#right'),
    eyes = [leye, reye], // array of eyes to move
    eyeCount = eyes.length,
    wrapper = document.getElementsByClassName('wrapper')[0], // boundary container
    R = 0, //todo: capitalized vars typically constants
    THETA = 0,
    wrapperWidth = wrapper.offsetWidth,
    wrapperHeight = wrapper.offsetHeight,
    bMouseOver = false;

/**
* update the computed pupil (polar) coordinates given a mouse event
* treat bbox as circumscribed by a bounding circle for more
* intuitive pupil movement
*/

var mx = 320;
var my = 240;

function updateEyes(posX, posY) {
  var mx = 640-posX,
      my = posY,
      width = 640,
      height = 480;

  var x, y, bboxWidth, bboxHeight, bbRadius;

  bMouseOver = true;

  // center x, y
  x = mx - width/2;
  y = my - height/2;

  // get bbox bounds
  bboxWidth = wrapperWidth;
  bboxHeight = wrapperHeight;
  bbRadius = Math.sqrt(Math.pow(bboxWidth,2) + Math.pow(bboxHeight, 2)) /2;

  // computer,  theta
  R = Math.sqrt(Math.pow(x,2) + Math.pow(y,2)) / bbRadius;
  THETA = Math.atan2(y,x);

}

function returnToNeutral() {
  bMouseOver = false;
}

/* draw pupil updates on animation frame */
function draw() {
  window.requestAnimationFrame(draw);

  // reduce R if mouse isn't on screen
  var dr = config.returnSpeed;
  if (!bMouseOver && R!==0) {
    dr = (Math.abs(R) < 0.01) ? 0.01 : R * dr;
    R -= dr;
  }

  // move all eyes
  for (var e=0; e<eyes.length; e++) {
    eyes[e].movePupil(R, THETA);
  }

}
draw();

/**
* blinking
* -----------------------------
*/

/* logic */
function blinkLogic() {
  var r = Math.random();

  // single blink
  if (r<0.5) blinkEyes();

  // fast double blink
  else if (r<0.6) {
    blinkEyes();
    setTimeout(blinkEyes, 120);
  }

  // slow double blink
  else if (r < 0.8) {
    blinkEyes();
    setTimeout(blinkEyes, 500 + Math.random()*400);
  }
}

/* blink and unblink eyes */
function blinkEyes() {
  eyes.forEach(function(eye) {
    eye.blink();
  });
  setTimeout(function() {
    eyes.forEach(function(eye) {
      eye.blink();
    });
  }, 75);
}

/* check blink logic every 800 ms */
setInterval(blinkLogic, 3500);


function heartEyes() {
  pupilis = document.getElementsByClassName("pupil");
  pupilis[0].setAttribute("class", "pupil heart");
  pupilis[1].setAttribute("class", "pupil heart");
  setTimeout(function() {
    removeHeartEyes();
  }, 2000);
}
function removeHeartEyes() {
  pupilis = document.getElementsByClassName("pupil");
  pupilis[0].setAttribute("class", "pupil");
  pupilis[1].setAttribute("class", "pupil");
}

/**
* Event handlers
*------------------------------------
*/

/* return eyes to neutral position */
document.addEventListener('mouseleave', returnToNeutral, false);

window.addEventListener('resize', function() {
  wrapperWidth = wrapper.offsetWidth;
  wrapperHeight = wrapper.offsetHeight;
});



var wsbroker = "192.168.137.138";  //mqtt websocket enabled broker
var wsport = 1884 // port for above
// Create a client instance
var client = new Paho.MQTT.Client(wsbroker, wsport,
    "myclientid_" + parseInt(Math.random() * 100, 10));

// set callback handlers
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// connect the client
client.connect({onSuccess:onConnect});

// called when the client connects
function onConnect() {
  // Once a connection has been made, make a subscription and send a message.
  console.log("onConnect");
  client.subscribe("X");
  client.subscribe("Y");
  client.subscribe("smile");
}

var posX = 0;
var posY = 0;

// called when the client loses its connection
function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0) {
    console.log("onConnectionLost:"+responseObject.errorMessage);
  }
}

// called when a message arrives
function onMessageArrived(message) {
  console.log(message.destinationName, ' -- ', message.payloadString);

  if (message.destinationName == "X"){
    posX = message.payloadString;
  }
  if (message.destinationName == "Y"){
    posY = message.payloadString;
    console.log(message.payloadString);
  }
  if (message.destinationName == "smile"){
    heartEyes();
  }
  updateEyes(posX, posY);

}
