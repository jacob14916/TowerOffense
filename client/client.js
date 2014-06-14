// Lobby templates

Template.lobby.greeting = function () {
  return "Welcome to TestCircles.";
};

Template.lobby.numconnected = function () {
  var amt = Players.find().count();
  if (amt == 1) {
    return "1 player in lobby - just you:";
  } else {
    return amt + " players in lobby:";
  }
}

Template.lobby.getname = function () {
  return Session.get("name");
}

Template.lobby.playerlist = function () {
  return Players.find({}).fetch().sort(function (a, b) {
    return (a.name > b.name)?1:-1;
  });
};

Template.lobby.makeplayerbutton = function (data) {
  return Template.playerbutton(data);
}

Template.lobby.challengers = function () {
  return Games.find({player_2: Session.get("player_id"), status: "challenge"}).fetch();
}

Template.lobby.showchallenger = function (chlg) {
  return Template.challenge(chlg);
}

Template.lobby.showlobby = function () {
  var p_id = Session.get("player_id");
  return !Games.findOne({$or: [{player_1: p_id}, {player_2: p_id}], status: "playing"});
}

Template.lobby.events({
  'keydown .nameinput' : function (event, instance) {
    if (event.which == 13) { // 13 is the enter key event
      var name = instance.find('.nameinput').value;
      if (name != '') {
        Session.set("name", name);
        Players.update({_id:Session.get("player_id")}, {$set: {name: name}});
      }
    }
  },
  'click .nameinput' : function (evt, instance) {
    var node =  instance.find('.nameinput');
    if (node.value == "anonymous") node.value = '';
  }
});

//--------

Template.playerbutton.events({
  'click':function (evt, instance) {
    challenge_player(instance.data);
  }
});

//--------

Template.challenge.player_1_name = function () {
  return Players.findOne({_id: this.player_1}).name;
}

Template.challenge.events({
  'click [name=accept]': function (evt, instance) {
    Games.update({_id: instance.data._id}, {$set: {status: "playing"}});
    //Meteor.call();
  },
  'click [name=decline]': function (evt, instance) {
    Games.update({_id: instance.data._id}, {$set: {status: "declined"}});
  }
})

//--------

Template.mychallenge.getmychallenge = function () {
  var game = Games.findOne({player_1: Session.get("player_id")});
  if (!game) return "no one";
  return Players.findOne({_id: game.player_2}).name;
}

Template.mychallenge.status = function () {
  var game = Games.findOne({player_1: Session.get("player_id")});
  if (!game) return "<i>Click one of the players in the lobby to challenge them</i>";
  if (game.status == "challenge") return "Pending";
  if (game.status == "declined") return "Declined";
  if (game.status == "playing") return "Accepted - Playing!";
}

Template.mychallenge.showcancel = function () {
  return !!Games.findOne({player_1: Session.get("player_id")});
}

Template.mychallenge.events({
  'click [name=cancel]' : function () {
    var game = Games.findOne({player_1: Session.get("player_id")});
    Games.remove({_id: game._id});
  }
});

//--------

Template.chat.messages = function () {
  return Chat.find().fetch().sort(function (a, b) {
    return a.date.valueOf() - b.date.valueOf(); // oldest to newest
  });
}

Template.chat.showmessage = function (msg) {
  return "<b>" + msg.player_name + "</b>: " + msg.text + "<br>";
}

Template.chat.rendered = function () {
  var div = this.find(".chat");
  div.scrollTop = div.scrollHeight;
}

Template.chat.events({
  'keydown .chatinput' : function (evt, instance) {
    if (evt.which == 13) {
      var txt = instance.find(".chatinput");
      Chat.insert({date: new Date(), text: txt.value, player_id: Session.get("player_id"),
                   player_name: Session.get("name")}); // will not have reactive names
      if (Chat.find().count() > 30) { // limit of 30 chats
        var oldchat = Chat.find().fetch().sort(function (a, b) {
          return b.date.valueOf() - a.date.valueOf(); // newest to oldest
        })[30];
        Meteor.call("clear_older_chats", oldchat.date);
      }
      txt.value = "";
    }
  }
});

//------------------------
// Lobby logic

var challenge_player = function (pdata) {
  if (pdata._id == Session.get("player_id")) {
    return;
  }
  var possiblegame = Games.findOne({player_1: pdata._id, player_2: Session.get("player_id")});
  if (possiblegame) {
    Games.update({_id: possiblegame._id}, {$set: {status: "playing"}});
    return;
  }
  var oldgame = Games.findOne({player_1: Session.get("player_id")});
  if (oldgame) Games.remove({_id: oldgame._id});
  Games.insert(new Game(Session.get("player_id"), pdata._id));
}

//------------------------
// Game templates

Template.game.rendered = function () {
  stage = new PIXI.Stage(0xFFFFFF);
  var containerdiv = this.find(".gamecontent");
  renderer = PIXI.autoDetectRenderer(800,800);

  containerdiv.appendChild(renderer.view);
  LogUtils.log(renderer);
  renderer.render(stage);

  E.tick();
}

//------------------------
// Game logic

// Note to self:
// Resume work at "//$" sign

Engine = function () {
  this.framestack = []; // 0 is newest
  this.commands = []; // 0 is newest!!!
  this.systems = {};
  this.command_handlers = {};
  this.system_cache = {};
  this.renderers = {};
  this.system_data = {};
  this.graphics_data = {}; // do I need this?
  this.entities = {};
}

Engine.prototype.tick = function (evt) {
  var now = new Date();
  var delta = (now - this.currentFrameTime) || 0;
  this.currentFrameTime = now;
  this.stepFrame(delta);
  this.renderFrame();
}

Engine.prototype.createEntity = function (components, id) {
  var ent = {};
  for (var i in components) {
    var c = components[i];
    ent[c.type] = c;
  }
  if (id) {
    ent._id = id;
  } else {
    ent._id = Meteor.uuid(); // Should not be invoked
  }
  this.addEntity(ent);
}

Engine.prototype.destroyEntity = function (id) {
  delete this.entities[id];
}

Engine.prototype.addEntity = function (ent) {
  this.entities[ent._id] = ent;
}

Engine.prototype.addSystems = function () {
  for (var i in arguments) {
    var sys = arguments[i];
    this.systems[sys.type] = sys;
  }
}

Engine.prototype.addRenderers = function () {
  for (var i in arguments) {
    var sys = arguments[i];
    this.renderers[sys.type] = sys;
  }
}

Engine.prototype.gatherEvents = function () { // meteor does not play well with key events
  var meteor_events = {}, final_meteor_events = {}, key_events = {};
  for (var i in this.systems) {
    if (this.systems[i].events) {
      var sys_evts = this.systems[i].events();
      for (var e in sys_evts) {
        var evt_object = meteor_events;
        if (e.length > 3 && e.slice(0,3) == "key") {
          evt_object = key_events;
        }
        if (evt_object[e]) {
          evt_object[e].push(sys_evts[e]);
        } else {
          evt_object[e] = [sys_evts[e]];
        }
      }
    }
  }
  for (var i in key_events) {
    window.addEventListener(i, this.makeEventHandler(key_events[i], i));
  }
  for (var i in meteor_events) {
    final_meteor_events[i] = this.makeEventHandler(meteor_events[i], i);
  }
  return final_meteor_events;
}

Engine.prototype.makeEventHandler = function (sys_evt_handlers, type) {
  var engine = this;
  return function (evt, instance) {
    for (var e in sys_evt_handlers) {
      var cmd = sys_evt_handlers[e](evt, instance);
      if (cmd) {
        engine.commands.splice(0,0,cmd);
      }
    }
  }
}

Engine.prototype.insertRemoteCommand = function (cmd) { //$ work on next
  //LogUtils.log("insertremotecommand", cmd);
  var found = false;
  for (var i in this.commands) {
    if (this.commands[i]._time < cmd._time) {
      this.commands.splice(i, 0, cmd);
      found = true;
      break;
    }
  }
  if (!found) {
    //LogUtils.log(this.commands)
    this.commands.push(cmd);
  }
  var amtafter = 0;
  var time;
  for (var i in this.framestack) {
    if (this.framestack[i]._time < cmd._time) {
      amtafter = i;
      time = this.framestack[i]._time;
      break;
    }
  }
  //LogUtils.log("time=" + time, "amtafter=" + amtafter);
  this.framestack = [this.reconstructFrame(amtafter)];
  this.entities = $.extend(true, {}, this.framestack[0].entities);
  this.system_data = $.extend(true, {}, this.framestack[0].system_data);
  var timediff = this.currentFrameTime - time;
  var amt_steps = Math.floor(timediff / 200); // 5 frames per second (make 50 later?)
  //LogUtils.log("timediff=" + timediff + ", steps=" + amt_steps);
  for (var i = 0; i < amt_steps; i++) {
    this.stepFrame(200);
  }
  this.stepFrame(timediff % 200); // catch up
}

Engine.prototype.getMatchingEntities = function (sys) {
  var matching_ents = {};
  for (var e in this.entities) {
    var ent = this.entities[e];
    if (sys.matches(ent)) {
      matching_ents[e] = ent;
    }
  }
  return matching_ents;
}

Engine.prototype.runFrame = function (delta) {
  //LogUtils.log("runframe " + delta);
  for (var i in this.systems) { //! very slow right now - whatever
    var sys = this.systems[i];
    if (!sys.tick) continue;
    sys.tick(this.getMatchingEntities(sys), delta);
  }
  if (this.framestack.length > 10) {
    this.discardFramesBeforeIndex(10);
  }
}

Engine.prototype.discardFramesBeforeTime = function (treconstrucime) {
  var index = 0;
  for (var i in this.framestack) {
    if (this.framestack[i]._time < time) {
      index = i;
      break;
    }
  }
  this.discardFramesBeforeIndex(index);
}

Engine.prototype.discardFramesBeforeIndex = function (index) {
  this.framestack.splice(index + 1, this.framestack.length - index);
}

/*

Command instruction options:
- createEntity
- destroyEntity
- changeEntityComponentValue
- changeSystemDataValue

*/

Engine.prototype.executeCommand = function (cmd) {
  LogUtils.log("executeCommand ", cmd);
  var instructions = [];
  for (var i in this.systems) {
    var sys = this.systems[i];
    if (sys.run && sys.commandMatches(cmd)) {
      var sys_ins = sys.run(cmd, this.getMatchingEntities(sys));
      if (sys_ins) {
        instructions = instructions.concat(sys_ins);
      } else {
        return false;
      }
    }
  }
  for (var i in instructions) {
    var instruction = instructions[i];
    if (instruction.createEntity) {
      this.createEntity(instruction.createEntity);
    } else if (instruction.destroyEntity) {
      this.destroyEntity(instruction.destroyEntity);
    } else if (instruction.changeEntityComponentValue) {
      var val = instruction.changeEntityComponentValue;
      this.entities[val.entityId][val.componentType][val.componentField] = val.componentFieldValue;
    } else if (instruction.changeSystemDataValue) {
      var val = instruction.changeSystemDataValue;
      this.system_data[val.systemType][val.systemDataField] = val.systemDataFieldValue;
    }
  }
  return true;
}

Engine.prototype.stepFrame = function (delta, nodump) { // (delta in ms, *dump at end?) -> undefined
  LogUtils.log("stepFrame " + delta);
  var last_time = (this.framestack.length)?this.framestack[0]._time:this.currentFrameTime;
  var target_time = new Date(last_time.valueOf() + delta);
  ////LogUtils.log(last_time.valueOf(), this.currentFrameTime.valueOf(), target_time.valueOf(), new Date(target_time).valueOf());
  var failed_commands = [];
  for (var i = this.commands.length - 1; i >= 0; i--) { // iterate from oldest to newest
    var cmd = this.commands[i];
    if (cmd._time > last_time && cmd._time < target_time) {
      LogUtils.log("Attempting to run", cmd);
      this.stepFrame(cmd._time - last_time, true);
      if (!this.executeCommand(cmd)) {
        LogUtils.log(cmd, "failed");
        failed_commands.push(cmd);
      }
      this.dumpFrame(cmd._time);
      last_time = cmd._time;
    }
  }
  for (var i in failed_commands) {
    this.commands.splice(this.commands.indexOf(failed_commands[i]), 1);
  }
  this.runFrame(delta);
  if (!nodump) {
    this.dumpFrame(new Date(target_time));
  }
}

Engine.prototype.dumpFrame = function (time) { // (time to stamp) -> undefined
  //LogUtils.log("dumpframe @ ", time);
  this.framestack.splice(0, 0, {
    _time: time,
    entities: this.entities,
    system_data: this.system_data
  });
}

Engine.prototype.reconstructFrame = function (which) { // (index to reconstruct) -> that frame, reconstructed deprecated
  return this.framestack[which];
}

Engine.prototype.renderFrame = function () {
  var frame = this.reconstructFrame(0);
  for (var i in this.renderers) {
    this.renderers[i].render(frame);
  }
  renderer.render(stage);
}

/*

A System defines the following:
- A constructor taking a single, optional argument (the Engine instance it is added to)
- A member, engine, that is the Engine instance it is added to
- A member, type, that is a unique (to that System) string giving the type of the engine. Should be same for all instances of same System.
- A member, local_data, that contains data that matters only to the current client
- A function, matches, that takes an entity and returns whether the system should process it
- At least one of the following:
  - A function, tick, that takes an object of entities and the time in ms to tick by
  - A function, run, that takes a command and a list of entities potentially relevant to the command's execution
- No other members for data storage (helper functions are fine)
- Systems should use engine.system_data for variable data that should be same between clients

A Command defines the following:
- A constructor taking two arguments, data and time (see below)
- A member, data, that is an object containing data relevant to the command
- A member, time, that is the Date of the creation of the command

An Entity is an object containing the components that make it up in key-value pairs: component.type : component
- Also defines a member, _id, which is a unique string or atomic value, usually of the form R123 or B45 (R for red, B for blue)

A Component defines the following:
- A member, type, that is a unique string (to that Component) giving the type of the Component

*/

TowerRotatorSystem = function (engine) {
  this.type = "TowerRotator";
  this.engine = engine;
  this.engine.system_data[this.type] = {rotationRate: 0.1}; // 0.1 rotations per second
}

TowerRotatorSystem.prototype.matches = function (ent) {
  return (ent["TowerRotation"] && ent["Position"]);
}

TowerRotatorSystem.prototype.commandMatches = function (cmd) {
  return (cmd.type == "MultiplyRotationRate");
}

TowerRotatorSystem.prototype.run = function (cmd) {
  var systype = this.type;
  switch (cmd.type) {
    case "MultiplyRotationRate":
      var newRate = this.engine.system_data[systype].rotationRate * cmd.data.factor;
      if (newRate < 10 && newRate > 0.001) {
        return [{
            changeSystemDataValue: {
              systemType: systype,
              systemDataField: "rotationRate",
              systemDataFieldValue: newRate
            }
          }];
      }
  }
  return false;
}

TowerRotatorSystem.prototype.tick = function (ents, delta) {
  var twopi = Math.PI * 2;
  var amount = this.engine.system_data[this.type].rotationRate * delta * twopi / 1000;
  for (var i in ents) {
    var ent = ents[i];
    var pos = ent["Position"];
    pos.rotation += amount * ent["TowerRotation"].factor;
    if (pos.rotation > twopi) {
      pos.rotation -= twopi;
    } else if (pos.rotation < 0) {
      pos.rotation += twopi;
    }
  }
}

TowerRotatorSystem.prototype.events = function () {
  return {
    'keydown' : function (evt) {
      switch (evt.which) {
        case 187: // +, = button
          return new MultiplyRotationRateCommand({factor: 2});
        case 189: // -, _ button
          return new MultiplyRotationRateCommand({factor: 0.5});
        default:
          break;
      }
    }
  };
}

//--------

PlaceTowerSystem = function (engine) {
  this.type = "PlaceTower";
  this.engine = engine;
  this.local_data = {
    footRadius: 30,
    towerTypes: ["HeavyTurret", "MachineGun", "Sniper", "Turret"],
    towerRotationFactors: [1, -2, -1, 2],
    towerIndex: 0,
    towerColors: ["Blue", "Red"],
    colorIndex: 0
  };
}

PlaceTowerSystem.prototype.events = function () {
  var that = this;
  LogUtils.log(that.local_data.towerTypes[that.local_data.towerIndex] +
                                      that.local_data.towerColors[that.local_data.colorIndex] + ".png");
  return {
    'click .gamecontent' : function (evt) {
      return new PlaceTowerCommand({position: new PIXI.Point(evt.offsetX, evt.offsetY),
                                    footRadius: that.local_data.footRadius,
                                    rotationFactor: that.local_data.towerRotationFactors[that.local_data.towerIndex],
                                    towerUrl: that.local_data.towerTypes[that.local_data.towerIndex] +
                                      that.local_data.towerColors[that.local_data.colorIndex] + ".png"});
    },
    'keydown' : function (evt) {
      switch (evt.which) {
        case 67: // c
          that.local_data.colorIndex = (that.local_data.colorIndex + 1) % 2;
          break;
        case 88: // x
          that.local_data.towerIndex = (that.local_data.towerIndex + 1) % 4;
          break;
      }
      return false;
    }
  }
}

PlaceTowerSystem.prototype.matches = function (ent) {
  return (ent["Position"] && ent["Footprint"]);
}

PlaceTowerSystem.prototype.commandMatches = function (cmd) {
  return (cmd.type == "PlaceTower");
}

PlaceTowerSystem.prototype.run = function (cmd, ents) {
  switch (cmd.type) {
    case "PlaceTower":
      LogUtils.log("Placing tower", ents);
      var pos = cmd.data.position;
      var fradius = cmd.data.footRadius;
      for (var i in ents) {
        var sumFootRadii = ents[i]["Footprint"].radius + fradius;
        LogUtils.log("Distance^2 between entity "+i+" and attempted placement is " + Geometry.distanceSquared(pos, ents[i]["Position"].position) + "; max is " + sumFootRadii * sumFootRadii);
        if (Geometry.distanceSquared(pos, ents[i]["Position"].position) < sumFootRadii * sumFootRadii) {
          LogUtils.log("Failed; distanceSquared = "+Geometry.distanceSquared(pos, ents[i]["Position"].position));
          return false;
        }
      }
      return [{createEntity: [new PositionComponent(pos, 0),
                              new TowerRotationComponent(cmd.data.rotationFactor),
                              new FootprintComponent(fradius),
                              new BitmapGraphicsComponent(cmd.data.towerUrl, true)]}];
  }
  return false;
}

//--------

BitmapGraphicsRenderer = function (engine) {
  this.type = "BitmapGraphics";
  this.engine = engine;
  this.local_data = {};
}

BitmapGraphicsRenderer.prototype.render = function (frame) {
  var destroyed = _.keys(this.local_data);
  for (var i in frame.entities) {
    var ent = frame.entities[i];
    var pos, bmp;
    if ((bmp = ent["BitmapGraphics"]) && (pos = ent["Position"])) {
      if (this.local_data[ent._id]) {
        destroyed.splice(destroyed.indexOf(ent._id), 1);
        var sprite = this.local_data[ent._id].sprite;
        sprite.rotation = pos.rotation;
        sprite.position.x = pos.position.x;
        sprite.position.y = pos.position.y;
      } else {
        this.local_data[ent._id] = {};
        var sprite = new PIXI.Sprite(PIXI.Texture.fromImage(bmp.imageUrl));
        if (bmp.centered) {
          sprite.anchor.x = 0.5;
          sprite.anchor.y = 0.5;
        }
        sprite.rotation = pos.rotation;
        sprite.position.x = pos.position.x;
        sprite.position.y = pos.position.y;
        this.local_data[ent._id].sprite = sprite;
        stage.addChild(sprite);
      }
    }
  }
  for (var i in destroyed) {
    stage.removeChild(this.local_data[i].sprite);
    delete this.local_data[i];
  }
}

//--------

PositionComponent = function (position, rotation) {
  this.type = "Position";
  this.position = position;
  this.rotation = rotation;
}

TowerRotationComponent = function (factor) {
  this.type = "TowerRotation";
  this.factor = factor;
}

FootprintComponent = function (radius) {
  this.type = "Footprint";
  this.radius = radius;
}

BitmapGraphicsComponent = function (imageUrl, centered) {
  this.type = "BitmapGraphics";
  // Assuming these don't change at runtime
  this.imageUrl = imageUrl;
  this.centered = centered;
}

//--------

PlaceTowerCommand = function (data, time) {
  this._time = time || new Date();
  this.type = "PlaceTower";
  this.data = data;
}

MultiplyRotationRateCommand = function (data, time) {
  this._time = time || new Date();
  this.type = "MultiplyRotationRate";
  this.data = data;
}

//------------------------
// Game utils

Geometry = {};

Geometry.circleRegionsDisjoint = function (c1, r1, c2, r2) {
  var sum_radii = r1 + r2;
  return Geometry.distanceSquared(c1, c2) > sum_radii * sum_radii;
}

Geometry.distance = function (pt1, pt2) {
  return Math.sqrt(Geometry.distanceSquared(pt1, pt2));
}

Geometry.distanceSquared = function (pt1, pt2) {
  var dx = pt1.x - pt2.x, dy = pt1.y - pt2.y;
  return dx * dx + dy * dy;
}

Geometry.randomAngle = function () { // Random is unacceptable for deterministic gameplay
  return Math.random() * 2 * Math.PI;
}

LogUtils = {
  enabled: true
};

LogUtils.nth = function (n) {
  var strn = n.toString();
  if (strn.length == 2) return strn + "th";
  var lastChar = strn.charAt(strn.length - 1);
  switch (lastChar) {
    case "1":
      return strn + "st";
    case "2":
      return strn + "nd";
    case "3":
      return strn + "rd";
    default:
      return strn + "th";
  }
}

LogUtils.log = function () {
  if (this.enabled) {
    console.log.apply(console, arguments);
  }
}
//------------------------

E = new Engine();
E.addSystems(new PlaceTowerSystem(E), new TowerRotatorSystem(E));
E.addRenderers(new BitmapGraphicsRenderer(E));
Template.game.events(E.gatherEvents()); //Yes!
Template.lobby.events({'keydown':function (evt) {LogUtils.log(evt);}});

Meteor.startup(
  function () {
    Meteor.subscribe("players");
    Meteor.subscribe("games");
    Meteor.subscribe("chat");

    var player_id = Players.insert({name: 'anonymous', status: 0});
    Session.set("player_id", player_id);
    Meteor.call('register_player_connection', player_id);
    Session.set("name", "anonymous");


    //E.tick();
    //Meteor.setInterval(function(){E.tick()}, 1000);
  }
)
