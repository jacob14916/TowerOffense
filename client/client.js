// Constants

MS_PER_FRAME = 30;
GUESS_LATENCY = 100; // guess 100 ms for other client to respond

START_DATA = {
  1: {
    position: new PIXI.Point(200,200),
    id: "StartTower1"
  },
  2: {
    position: new PIXI.Point(600,600),
    id: "StartTower2"
  }
}

FRAMESTACK_LEN = 200;

HB_COLOR = 0x20E020;
HB_DAMAGECOLOR = 0xFF0000;
HB_WIDTH = 48;
HB_OFFSET = 24;
HB_THICKNESS = 3;


LINK_WIDTH = 5;
LINK_ALPHA = 0.4;

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
    // startup
    Meteor.setTimeout(start_game.bind(null, instance.data._id, Colors[2]), GUESS_LATENCY);
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

var oldStatus, oldMessage;

Template.mychallenge.status = function () {
  var message = "";
  var game = Games.findOne({player_1: Session.get("player_id")});
  if (!game) {
    if (oldStatus) {
      oldStatus = null;
      oldMessage = null;
    }
    return "<i>Click one of the players in the lobby to challenge them</i>";
  } else if (game.status == oldStatus) return oldMessage;
  else if (game.status == "challenge") message = "Pending";
  else if (game.status == "declined") message = "Declined";
  else if (game.status == "playing") {
    LogUtils.log(this.oldStatus);
    start_game(game._id, Colors[1]);
    message = "Accepted - playing!"
  }
  oldStatus = game.status;
  oldMessage = message;
  return message;
}

Template.mychallenge.showcancel = function () {
  return !!Games.findOne({player_1: Session.get("player_id")});
}

Template.mychallenge.events({
  'click [name=cancel]' : function () {
    if (game_handle.playing) {
      end_game();
    } else {
      var game = Games.findOne({player_1: Session.get("player_id")});
      Games.remove({_id: game._id});
    }
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

challenge_player = function (pdata) {
  if (pdata._id == Session.get("player_id")) {
    return;
  }
  var possiblegame = Games.findOne({player_1: pdata._id, player_2: Session.get("player_id")});
  if (possiblegame) {
    //Games.update({_id: possiblegame._id}, {$set: {status: "playing"}});
    return;
  }
  var oldgame = Games.findOne({player_1: Session.get("player_id")});
  if (oldgame) Games.remove({_id: oldgame._id});
  Games.insert(new Game(Session.get("player_id"), pdata._id));
}

game_handle = {};
game_start_time = null;
world_offset_x = 0;
world_offset_y = 0;

start_game = function (id, color) {
  Session.set("client_color", Colors.screenColors[color].toString(16));
  var other_color = Colors.other(color);
  game_start_time = performance.now();
  E.startup(color, id);
  var observe_handle = Commands.find({game_id: id, color: other_color}).observe({
    added: function (cmd) {
      LogUtils.log("Received command from enemy", cmd);
      E.insertRemoteCommand(cmd);
      Commands.remove({_id: cmd._id});
    }
  });
  var last_time = performance.now();
  var anim_handler = function (timestamp) {
    E.tick(timestamp - last_time);
    last_time = timestamp;
    requestAnimationFrame(anim_handler);
  }
  game_handle.loopHandle = requestAnimationFrame(anim_handler);
  game_handle.observeHandle = observe_handle;
  game_handle._id = id;
  game_handle.playing = true;
}

end_game = function () {
  cancelAnimationFrame(game_handle.loopHandle);
  game_handle.observeHandle.stop();
  game_handle.playing = false;
  E.reset();
  Games.remove({_id: game_handle._id});
  for (var i = 0, len = Stage.children.length; i < len; i++) {
    Stage.removeChild(Stage.children[0]);
  }
}

//------------------------
// Game templates

Template.game.rendered = function () {
  Stage = new PIXI.Stage(0x888888);
  World = new PIXI.DisplayObjectContainer();
  Stage.addChild(World);
  var containerdiv = this.find(".gamecontent");
  Renderer = PIXI.autoDetectRenderer(window.innerWidth - 330, window.innerHeight - 110, undefined, false, true);

  containerdiv.appendChild(Renderer.view);
  LogUtils.log(Renderer);
  //Stage.addChild(new PIXI.TilingSprite(PIXI.Texture.fromImage("SeamlessRockFace.jpg"), 1920, 1080)); find/make background later
  Renderer.render(Stage);
  window.addEventListener("keydown", function (evt) {
    switch (evt.which) {
      case 37: // left
        world_offset_x += 20;
        World.position.x += 20;
        break;
      case 38:
        world_offset_y += 20;
        World.position.y += 20;
        break;
      case 39:
        world_offset_x -= 20;
        World.position.x -= 20;
        break;
      case 40:
        world_offset_y -= 20;
        World.position.y -= 20;
        break;
    }
  });
}

Template.gameui.client_color = function () {
  var hex = Session.get("client_color");
  if (!hex) {
    return "rgba(0,0,0,0)";
  }
  for (var i = 0, to_go = 6 - hex.length; i < to_go; i++) {
    hex = "0" + hex;
  }
  return "#" + hex;
}

Template.gameui.resource_amount = function () {
  return Session.get("resourceAmount") || 0;
}

//------------------------
// Game logic

// Note to self:
// Resume work at "//$" sign

Engine = function () {
  this.systems = {};
  this.renderers = [];
  this.command_handlers = [];
  this.tickers = [];
  this.startup_order = [];
  this.reset();
}

Engine.prototype.startup = function (color, id) {
  this.client_color = color;
  this.game_id = id;
  this.active = true;
  var cmdlist = [];
  for (var i in this.startup_order) {
    var sys_cmds = this.systems[this.startup_order[i]].startup();
    if (sys_cmds) {
      Array.prototype.push.apply(cmdlist, sys_cmds);
    }
  }
  for (var i in cmdlist) {
    this.executeCommand(cmdlist[i]);
  }
  this.tick(0);
}

Engine.prototype.reset = function () {
  this.framestack = []; // 0 is newest
  this.commands = []; // 0 is newest!!!
  this.system_data = {};
  this.entities = {};
  this.game_id = null;
  this.client_color = null;
  this.currentFrameTime = 0; // time = relative game time
  //this.currentFrameDate = null; // date = actual client Date
  this.active = false;
  this.was_change_since = {};
}

Engine.prototype.tick = function (delta) {
  this.currentFrameTime += delta;
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
  this.notifyAllSystems(this.entities[id]);
  delete this.entities[id];
}

Engine.prototype.addEntity = function (ent) {
  this.entities[ent._id] = ent;
  this.notifyAllSystems(ent);
}

Engine.prototype.notifyAllSystems = function (ent) {
  for (var i in this.tickers) {
    var sys_type = this.tickers[i];
    this.was_change_since[sys_type] = this.systems[sys_type].matches(ent);
  }
}

Engine.prototype.addSystems = function () {
  for (var i in arguments) {
    var sys = arguments[i];
    this.systems[sys.type] = sys;
    if (sys.render) this.renderers.push(sys.type);
    if (sys.run) this.command_handlers.push(sys.type);
    if (sys.tick) this.tickers.push(sys.type);
    if (sys.startup) this.startup_order.push(sys.type);
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
    if (!engine.active) return;
    for (var e in sys_evt_handlers) {
      var cmd = sys_evt_handlers[e](evt, instance);
      if (cmd) {
        engine.insertCommand(cmd);
        Commands.insert(cmd);
      }
    }
  }
}

Engine.prototype.insertCommand = function (cmd) {
  var i;
  for (i in this.commands) {
    if (this.commands[i]._time < cmd._time) {
      break;
    }
  }
  this.commands.splice(i, 0, cmd);
}

Engine.prototype.insertRemoteCommand = function (cmd) {
  this.insertCommand(cmd);
  var time, amtafter = this.framestack.length - 1;
  for (var i in this.framestack) {
    if (this.framestack[i]._time < cmd._time) {
      amtafter = i;
      LogUtils.log("Frame #", i);
      time = this.framestack[i]._time;
      break;
    }
  }
  if (amtafter == 0) {
    // the command is from the future
    return;
  }
  this.framestack.splice(0, amtafter);
  this.entities = Utils.deepCopy(this.framestack[0].entities);
  this.system_data = Utils.deepCopy(this.framestack[0].system_data);
  var timediff = this.currentFrameTime - time;
  var amt_steps = Math.floor(timediff / MS_PER_FRAME); // 5 frames per second (make 50 later?)
  for (var i = 0; i < amt_steps; i++) {
    this.stepFrame(MS_PER_FRAME);
  }
  this.stepFrame(timediff % MS_PER_FRAME); // catch up
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
  for (var i in this.tickers) {
    var sys_type = this.tickers[i];
    var sys = this.systems[sys_type];
    var wasChange = this.was_change_since[sys_type];
    this.was_change_since[sys_type] = false;
    sys.tick(this.getMatchingEntities(sys), delta, wasChange);
  }
}

Engine.prototype.sortedEntities = function (matches, value) {
  return _.sortBy(_.filter(this.entities, matches), value);
}

Engine.prototype.bestEntity = function (matches, value) {
  return this.sortedEntities(matches, value)[0];
}

Engine.prototype.findEntity = function (matches) {
  for (var i in this.entities) {
    if (matches(this.entities[i])) {
      return this.entities[i];
    }
  }
}

Engine.prototype.discardFramesBeforeTime = function (time) {
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
  //LogUtils.log("executeCommand ", cmd);
  var instructions = [];
  for (var i in this.command_handlers) {
    var sys = this.systems[this.command_handlers[i]];
    if (sys.commandMatches(cmd)) {
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
      this.createEntity(instruction.createEntity.components, instruction.createEntity._id);
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
  //LogUtils.log("stepFrame " + delta);
  var last_time = (this.framestack.length)?this.framestack[0]._time:this.currentFrameTime;
  var target_time = last_time + delta;
  var failed_commands = [];
  for (var i = this.commands.length - 1; i >= 0; i--) { // iterate from oldest to newest
    var cmd = this.commands[i];
    if (cmd._time > last_time && cmd._time < target_time) {
      this.stepFrame(cmd._time - last_time, true);
      if (!this.executeCommand(cmd)) {
        failed_commands.push(cmd);
      }
      this.dumpFrame(cmd._time);
      last_time = cmd._time;
    }
  }
  for (var i in failed_commands) {
    this.commands.splice(this.commands.indexOf(failed_commands[i]), 1);
  }
  this.runFrame(target_time - last_time);
  if (!nodump) {
    this.dumpFrame(target_time);
    if (this.framestack.length > FRAMESTACK_LEN) {
      this.discardFramesBeforeIndex(FRAMESTACK_LEN - 1);
    }
  }
}

Engine.prototype.dumpFrame = function (time) { // (time to stamp) -> undefined
  this.framestack.splice(0, 0, {
    _time: time,
    entities: Utils.deepCopy(this.entities),
    system_data: Utils.deepCopy(this.system_data)
  });
}

Engine.prototype.renderFrame = function () {
  var frame = this.framestack[0];
  for (var i in this.renderers) {
    this.systems[this.renderers[i]].render(frame);
  }
  Renderer.render(Stage);
}

/*

A System defines the following:
- A constructor taking a single, optional argument (the Engine instance it is added to)
- A member, engine, that is the Engine instance it is added to
- A member, type, that is a unique (to that System) string giving the type of the engine. Should be same for all instances of same System.
- A member, local_data, that contains data that matters only to the current client
- A function, matches, that takes an entity and returns whether the system should process it
- At least one of the following:
  - A function, tick, that takes an object of entities, the time in ms to tick by, and whether there was an entity added or destroyed
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
}

TowerRotatorSystem.prototype.startup = function () {
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
}

PlaceTowerSystem.prototype.startup = function () {
  this.local_data = {
    footRadius: 30,
    towerTypes: ["Pylon", "HeavyTurret", "MachineGun", "Sniper", "Turret"],
    towerData: {
      Pylon: {
        type: "Pylon",
        activeLink: true,
        linkRadius: 150,
        health: 100,
        healthRegen: 4,
        footRadius: 21,
        nonattacking: true
      },
      HeavyTurret: {
        type: "HeavyTurret",
        health: 200,
        healthRegen: 1,
        attackRadius: 300,
        attackRegen: 0.5,
        attackDamage: 40,
        bulletSpeed: 200
      },
      MachineGun: {
        type: "MachineGun",
        health: 150,
        healthRegen: 3,
        attackRadius: 200,
        attackRegen: 4,
        attackDamage: 5,
        bulletSpeed: 400
      },
      Sniper: {
        type: "Sniper",
        health: 100,
        healthRegen: 1,
        attackRadius: 500,
        attackRegen: 1.2,
        attackDamage: 15,
        bulletSpeed: 500
      },
      Turret: {
        type: "Turret",
        health: 100,
        healthRegen: 2,
        attackRadius: 200,
        attackRegen: 1,
        attackDamage: 10,
        bulletSpeed: 200
      }
    },
    towerIndex: 0,
  };
  var start_commands = [], that = this;
  Colors.forEachColor(function (color, i) {
    start_commands.push(new PlaceTowerCommand({
      position: START_DATA[i].position.clone(),
      footRadius: 48,
      type: "HQ",
      overrideId: START_DATA[i].id,
      isRoot: true,
      linkRadius: 300,
      activeLink: true,
      nonattacking: true,
      health: 800,
      healthRegen: 10
    }, color));
  });
  return start_commands;
}

PlaceTowerSystem.prototype.events = function () {
  var that = this;
  return {
    'click .gamecontent' : function (evt) {
      if (evt.button == 0 && evt.shiftKey) {
        var type = that.local_data.towerTypes[that.local_data.towerIndex];
        var data = that.local_data.towerData[type];
        data.position = Utils.mousePoint(evt);
        return new PlaceTowerCommand(data, that.engine.client_color);
      }
    },
    'keydown' : function (evt) {
      if (evt.target.tagName == "INPUT") return false;
      switch (evt.which) {
        case 88: // x
          that.local_data.towerIndex = (that.local_data.towerIndex + 1) % 5;
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
      var data = cmd.data;
      var pos = data.position, fradius = data.footRadius || this.local_data.footRadius;
      LogUtils.log(fradius);
      for (var i in ents) {
        var sumFootRadii = ents[i]["Footprint"].radius + fradius;
        if (Geometry.distanceSquared(pos, ents[i]["Position"].position) < sumFootRadii * sumFootRadii) {
          return false;
        }
      }
      var towerUrl = data.type + cmd.color + ".png";
      var components = [new PositionComponent(pos, 0),
                        new FootprintComponent(fradius),
                        new BitmapGraphicsComponent(towerUrl, true),
                        new ColorComponent(cmd.color),
                        new HealthComponent(data.health, data.healthRegen),
                        new MiningComponent(0.2, 300),
                        new LinkageComponent(data.linkRadius, data.activeLink, data.isRoot)];
      if (!data.nonattacking) {
        components.push(new AttackComponent(data.attackDamage, data.attackRadius, data.attackRegen, data.bulletSpeed, 32, data.type + "Bullet"));
      }
      return [{createEntity:
               {components: components,
                _id: data.overrideId}}];
  }
  return false;
}

//--------

TowerLinkageSystem = function (engine) {
  this.type = "TowerLinkage";
  this.engine = engine;
}

TowerLinkageSystem.prototype.startup = function () {
  var linkageContainer = new PIXI.DisplayObjectContainer();
  var root_ids = {}, linkageGraphics = {};
  Colors.forEachColor(function (color, i) {
    root_ids[color] = START_DATA[i].id;
    linkageGraphics[color] = new PIXI.Graphics();
    linkageGraphics[color + "Circles"] = new PIXI.Graphics();
    linkageContainer.addChild(linkageGraphics[color]);
    linkageContainer.addChild(linkageGraphics[color + "Circles"]);
  });
  World.addChild(linkageContainer);
  this.local_data = {
    linkageContainer: linkageContainer,
    linkageGraphics: linkageGraphics,
    root_ids: root_ids,
    drawnLines: {},
    drawnCircles: {},
    dirty: false
  };
}

TowerLinkageSystem.prototype.matches = function (ent) {
  return ent["Color"] && ent["Position"] && ent["Linkage"];
}

TowerLinkageSystem.prototype.tick = function (ents, delta, wasChange) {
  if (wasChange) {
    LogUtils.log("Linkage graphics data dirty");
    this.clearLinks(ents);
    this.local_data.dirty = true;
    var that = this;
    Colors.forEachColor(function (color, i) {
      var color_ents = _.filter(ents, function (ent) {
        return ent["Color"].color == color;
      });
      var root = ents[that.local_data.root_ids[color]];
      if (root) {
        that.link(root, color_ents);
      }
    });
  }
}

TowerLinkageSystem.prototype.link = function (root, ents) {
  var r_id = root._id,
      r_pos = root["Position"].position,
      r_linkents = root["Linkage"].linkedEntities,
      r_rad2 = Math.pow(root["Linkage"].radius, 2),
      next_roots = [];
  for (var i in ents) {
    var ent = ents[i];
    if (ent._id != r_id && Geometry.distanceSquared(ent["Position"].position, r_pos) <= r_rad2 && !(_.contains(r_linkents, ent._id))) {
      var e_link = ent["Linkage"];
      e_link.linkedEntities.push(r_id);
      r_linkents.push(ent._id);
      e_link.isLinked = true;
      if (e_link.active) {
        next_roots.push(ent);
      }
    }
  }
  for (var i in next_roots) {
    this.link(next_roots[i], ents);
  }
}

TowerLinkageSystem.prototype.clearLinks = function (ents) {
  for (var i in ents) {
    var e_link = ents[i]["Linkage"];
    e_link.linkedEntities.length = 0;
    e_link.isLinked = false;
  }
}

/*TowerLinkageSystem.prototype.run = function () {
}*/

TowerLinkageSystem.prototype.render = function (frame) {
  this.local_data.drawnLines = {};
  this.local_data.drawnCircles = {};
  if (this.local_data.dirty) {
    var graphics = this.local_data.linkageGraphics, that = this;
    Colors.forEachColor(function (color, i) {
      var gfx = graphics[color];
      var cgfx = graphics[color + "Circles"];
      gfx.clear();
      gfx.lineStyle(LINK_WIDTH, Colors.pastelColors[color], 1);
      cgfx.clear();
      cgfx.beginFill(Colors.pastelColors[color], LINK_ALPHA/4);
      var root = frame.entities[that.local_data.root_ids[color]];
      if (root) {
        that.drawLines(root, frame.entities, gfx, cgfx);
      }
    });
    this.local_data.dirty = false;
  }
}

TowerLinkageSystem.prototype.drawLines = function (root, ents, graphics, cgraphics) {
  var r_linkents = root["Linkage"].linkedEntities,
      r_id = root._id,
      next_roots = [],
      r_x = root["Position"].position.x,
      r_y = root["Position"].position.y;
  graphics.moveTo(r_x, r_y);
  if (!this.local_data.drawnCircles[r_id]) {
    cgraphics.drawCircle(r_x, r_y, root["Linkage"].radius);
    this.local_data.drawnCircles[r_id] = true;
  }
  for (var i in r_linkents) {
    var ent = ents[r_linkents[i]];
    if (ent && !this.local_data.drawnLines[Utils.deterministicConcat(r_id, ent._id)]) {
      this.local_data.drawnLines[Utils.deterministicConcat(r_id, ent._id)] = true;
      graphics.lineTo(ent["Position"].position.x, ent["Position"].position.y);
      graphics.moveTo(root["Position"].position.x, root["Position"].position.y);
      if (ent["Linkage"].active) {
        next_roots.push(ent);
      }
    }
  }
  for (var i in next_roots) {
    this.drawLines(next_roots[i], ents, graphics, cgraphics);
  }
}

//--------

AttackSystem = function (engine) {
  this.engine = engine;
  this.type = "Attack";
}

AttackSystem.prototype.startup = function () {
  var rangeLayer = new PIXI.DisplayObjectContainer();
  var rangeGraphics = {};
  Colors.forEachColor(function (color, i) {
    rangeGraphics[color] = new PIXI.Graphics();
    rangeLayer.addChild(rangeGraphics[color]);
  });
  World.addChild(rangeLayer);
  this.local_data = {
    rangeLayer: rangeLayer,
    rangeGraphics: rangeGraphics,
    dirty: false
  };
}

AttackSystem.scoreTarget = function (ent_pos, tgt) { // lower is better
  var lnk = tgt["Linkage"]; // no unlinked enemies yet
  if (lnk.isRoot) return 0;
  var score = 100;
  score += Geometry.distance(ent_pos, tgt["Position"].position) / 10;
  if (!lnk.isLinked) return score;
  if (lnk.active) {
    score -= lnk.linkedEntities.length * 10;
  }
  if (tgt["Attack"]) {
    score -= tgt["Attack"].damage;
    score -= tgt["Attack"].charge * 10;
  }
  score -= tgt["Health"].max / 10;
  return score;
}

AttackSystem.prototype.matches = function (ent) {
  return ent["Position"] && ent["Color"] && ent["Attack"];
}

AttackSystem.prototype.tick = function (ents, delta, wasChange) { // smarter algorithm later
  var delta_secs = delta / 1000;
  this.local_data.dirty = wasChange;
  for (var i in ents) {
    var ent = ents[i];
    if (!(ent["Linkage"].isLinked || ent["Linkage"].isRoot)) continue;
    var attack = ent["Attack"];
    if (attack.charge < 1) {
      attack.charge += attack.regen * delta_secs;
    }
    if (attack.charge >= 1) {
      var ent_color = ent["Color"].color, ent_pos = ent["Position"].position, r2 = Math.pow(attack.radius, 2);
      var target = this.engine.bestEntity(function (tgt) {
        return (tgt["Color"] && tgt["Position"] && tgt["Health"] &&
               tgt["Color"].color != ent_color &&
               (Geometry.distanceSquared(ent_pos, tgt["Position"].position) <= r2));
      }, AttackSystem.scoreTarget.bind(null, ent_pos));
      if (target) {
        attack.charge -= 1;
        var rot = Geometry.rotationFromUp(ent_pos, target["Position"].position);
        ent["Position"].rotation = rot;
        var cos_rot = Math.sin(rot), sin_rot = -Math.cos(rot); // all screwed up because of PIXI coords
        var x = ent_pos.x + attack.barrelLength * cos_rot;
        var y = ent_pos.y + attack.barrelLength * sin_rot;
        this.engine.createEntity([ // fire!
          new PositionComponent(new PIXI.Point(x, y), rot),
          new BulletComponent(target._id, attack.damage, attack.speed * cos_rot, attack.speed * sin_rot),
          new BitmapGraphicsComponent(attack.bulletImage + ent_color + ".png", true),
          new ColorComponent(ent_color)
        ]);
      } else {
        attack.charge = 1;
      }
    }
  }
}

AttackSystem.prototype.render = function (frame) {
  if (this.local_data.dirty) {
    var gfx = this.local_data.rangeGraphics;
    Colors.forEachColor(function (color) {
      gfx[color].clear();
    });
    for (var i in frame.entities) {
      var ent = frame.entities[i];
      if (this.matches(ent) && (ent["Linkage"].isLinked || ent["Linkage"].isRoot)) {
        var color = ent["Color"].color, pos = ent["Position"].position;
        gfx[color].lineStyle(3, Colors.pastelColors[ent["Color"].color], 0.3);
        gfx[color].drawCircle(pos.x, pos.y, ent["Attack"].radius);
      }
    }
  }
}

//--------

BulletSystem = function (engine) {
  this.engine = engine;
  this.type = "Bullet";
}

BulletSystem.prototype.matches = function (ent) {
  return ent["Bullet"];
}

BulletSystem.prototype.tick = function (ents, delta) {
  var delta_secs = delta/1000;
  for (var i in ents) {
    var ent = ents[i];
    var pos = ent["Position"].position, bt = ent["Bullet"];
    var target = this.engine.entities[bt.target];
    if (!target) {
      this.engine.destroyEntity(ent._id);
      continue;
    }
    pos.x += bt.vx * delta_secs;
    pos.y += bt.vy * delta_secs;
    if (Geometry.distanceSquared(pos, target["Position"].position) < Math.pow(target["Footprint"].radius, 2)) {
      target["Health"].hp -= bt.damage;
      this.engine.destroyEntity(ent._id);
    }
  }
}

//BulletSystem.prototype.render = function (frame) {} // make custom bullet renderer later

//--------

DestroyDeadSystem = function (engine) {
  this.type = "DestroyDead";
  this.engine = engine;
}

DestroyDeadSystem.prototype.startup = function () {
  var explosionLayer = new PIXI.DisplayObjectContainer();
  var explosionTextures = [];
  var assetLoader = new PIXI.AssetLoader(["SpriteSheet.json"]);
  assetLoader.onComplete = function () {
    for (var i = 0; i < 26; i++) {
      var texture = PIXI.Texture.fromFrame("Explosion_Sequence_A " + (i+1) + ".png");
		 	explosionTextures.push(texture);
    }
  };
  assetLoader.load();
  World.addChild(explosionLayer);
  this.local_data = {
    explosionLayer: explosionLayer,
    explosionTextures: explosionTextures,
    explosionPositions: [],
    explosionPool: []
  }
}

DestroyDeadSystem.prototype.matches = function (ent) {
  return ent["Health"] && ent["Position"] && (ent["Health"].hp < 0);
}

DestroyDeadSystem.prototype.tick = function (ents) {
  for (var i in ents) {
    this.local_data.explosionPositions.push(ents[i]["Position"].position);
    this.engine.destroyEntity(ents[i]._id);
  }
}

DestroyDeadSystem.prototype.render = function () {
  if (this.local_data.explosionPositions.length) {
    for (var i in this.local_data.explosionPositions) {
      var sprite;
      if (this.local_data.explosionPool.length) {
        sprite = this.local_data.explosionPool.pop();
        sprite.visible = true;
      } else {
        sprite = new PIXI.MovieClip(this.local_data.explosionTextures);
        this.local_data.explosionLayer.addChild(sprite);
        sprite.loop = false;
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
      }
      sprite.position = this.local_data.explosionPositions[i];
      sprite.gotoAndPlay(0);
    }
    this.local_data.explosionPositions.length = 0;
  }
  for (var i in this.local_data.explosionLayer.children) {
    var sprite = this.local_data.explosionLayer.children[i];
    if (!sprite.playing) {
      sprite.visible = false;
      this.local_data.explosionPool.push(sprite);
    }
  }
}

//--------

HealthSystem = function (engine) {
  //$ work here next
  this.engine = engine;
  this.type = "Health";
}

HealthSystem.prototype.startup = function () {
  var hbGraphics = new PIXI.Graphics();
  var hbContainer = new PIXI.DisplayObjectContainer();
  hbContainer.addChild(hbGraphics);
  World.addChild(hbContainer);
  this.local_data = {
    hbGraphics: hbGraphics,
    hbContainer: hbContainer
  };
}

HealthSystem.prototype.matches = function (ent) {
  return ent["Position"] && ent["Health"];
}

HealthSystem.prototype.tick = function (ents, delta) {
  var delta_secs = delta / 1000;
  for (var i in ents) {
    var health = ents[i]["Health"];
    if (health.hp < health.max) {
      health.hp = Math.min(health.hp + delta_secs * health.regen, health.max);
    }
  }
}

HealthSystem.prototype.render = function (frame) {
  var bargfx = this.local_data.hbGraphics;
  bargfx.clear();
  bargfx.lineStyle(HB_THICKNESS, HB_COLOR, 1);
  for (var i in frame.entities) {
    var ent = frame.entities[i], health = ent["Health"];
    if (!health) {
      continue;
    }
    if (health.hp != health.max) {
      var x = ent["Position"].position.x - HB_WIDTH/2, y = ent["Position"].position.y + HB_OFFSET;
      bargfx.lineColor = HB_COLOR;
      bargfx.moveTo(x, y);
      bargfx.lineTo(x + (health.hp / health.max) * HB_WIDTH, y);
      bargfx.lineColor = HB_DAMAGECOLOR;
      bargfx.moveTo(x + (health.hp / health.max) * HB_WIDTH, y);
      bargfx.lineTo(x + HB_WIDTH, y);
    }
  }
}

//--------

ResourcesSystem = function (engine) {
  this.type = "Resources";
  this.engine = engine;
}

ResourcesSystem.prototype.startup = function () {
  var colorAmounts = {};
  Colors.forEachColor(function (color) {
    colorAmounts[color] = 300;
  })
  this.engine.system_data[this.type] = {
    circles: [
      {position: new PIXI.Point(400,400), amount: 1600, radius: 40},
      {position: new PIXI.Point(0,0), amount: 400, radius: 20},
      {position: new PIXI.Point(800,800), amount: 400, radius: 20}
    ],
    colorAmounts: colorAmounts
  };
  var resourceGraphics = new PIXI.Graphics();
  var resourceLayer = new PIXI.DisplayObjectContainer();
  resourceLayer.addChild(resourceGraphics);
  World.addChild(resourceLayer);
  this.local_data = {
    resourceLayer: resourceLayer,
    resourceGraphics: resourceGraphics,
    lastDisplayTime: 0
  };
}

ResourcesSystem.prototype.matches = function (ent) {
  return !!(ent["Mining"] && ent["Position"] && ent["Color"]);
}

ResourcesSystem.prototype.tick = function (ents, delta) {
  var delta_secs = delta / 1000;
  var sys_data = this.engine.system_data[this.type];
  var circles = sys_data.circles;
  var amounts_removed = [];
  for (var i in ents) {
    var ent = ents[i];
    var rate = ent["Mining"].rate * delta_secs,
        radius = ent["Mining"].radius,
        pos = ent["Position"].position,
        color = ent["Color"].color;
    var r2 = Math.pow(radius, 2);
    for (var j in circles) {
      var circle = circles[j];
      if (Geometry.distanceSquared(circle.position, pos) <= r2) {
        var amt = rate * circle.amount;
        amounts_removed[j] = amounts_removed[j] + amt || amt;
        sys_data.colorAmounts[color] += amt;
      }
    }
  }
  var i = 0;
  while (i < circles.length) {
    var circle = circles[i];
    circle.amount -= amounts_removed[i];
    if (circle.amount < 1) {
      circles.splice(i, 1);
      amounts_removed.splice(i, 1); // keeps i correct for amounts_removed as well
      continue;
    }
    circle.radius = Math.sqrt(circle.amount);
    i++;
  }
}

ResourcesSystem.prototype.render = function (frame) {
  var sys_data = frame.system_data[this.type];
  var circles = sys_data.circles,
      colorAmounts = sys_data.colorAmounts;
  if (circles.length) {
    var graphics = this.local_data.resourceGraphics;
    graphics.clear();
    graphics.beginFill(0, 0.5);
    for (var i in circles) {
      var circle = circles[i];
      graphics.drawCircle(circle.position.x, circle.position.y, circle.radius);
    }
  }
  if (frame._time - this.local_data.lastDisplayTime > 500) {
    if (Session.get("resourceAmount") != Math.floor(colorAmounts[this.engine.client_color])) {
      Session.set("resourceAmount", Math.floor(colorAmounts[this.engine.client_color]));
    }
    this.local_data.lastDisplayTime = frame._time;
  }
}

//--------

TowerSelectionSystem = function (engine) {
  this.type = "TowerSelection";
  this.engine = engine;
}

TowerSelectionSystem.prototype.startup = function () {
  var selectionSprite = PIXI.Sprite.fromImage("SelectionCircle.png");
  selectionSprite.visible = false;
  selectionSprite.anchor.x = 0.5;
  selectionSprite.anchor.y = 0.5;
  var selectionLayer = new PIXI.DisplayObjectContainer();
  World.addChild(selectionLayer);
  selectionLayer.addChild(selectionSprite);
  this.local_data = {
    selectedId: null,
    selectionSprite: selectionSprite,
    selectionLayer: selectionLayer
  };
}

TowerSelectionSystem.prototype.matches = function (ent) {
  return (ent._id == this.local_data.selectedId);
}

TowerSelectionSystem.prototype.events = function () {
  var that = this;
  return {
    'click .gamecontent' : function (evt) {
      if (evt.button == 0 && !evt.shiftKey) {
        var bestEntity = E.findEntity(function (ent) {
          return (ent["Footprint"] && ent["Position"] && ent["Color"] && ent["Color"].color == that.engine.client_color &&
                 Geometry.distanceSquared(ent["Position"].position, Utils.mousePoint(evt)) <= Math.pow(ent["Footprint"].radius, 2));
        });
        if (bestEntity) {
          that.local_data.selectedId = bestEntity._id;
          that.local_data.selectionSprite.visible = true;
        } else if (that.local_data.selectedId) {
          that.local_data.selectedId = null;
          that.local_data.selectionSprite.visible = false;
        }
      }
    }
  }
}

TowerSelectionSystem.prototype.render = function (frame) {
  if (this.local_data.selectedId) {
    var sel_ent = frame.entities[this.local_data.selectedId]
    if (sel_ent) {
      this.local_data.selectionSprite.position.x = sel_ent["Position"].position.x;
      this.local_data.selectionSprite.position.y = sel_ent["Position"].position.y;
      this.local_data.selectionSprite.rotation = Math.sin(frame._time.valueOf()/400);
    } else {
      this.local_data.selectedId = null;
      this.local_data.selectionSprite.visible = false;
    }
  }
}

//--------

BitmapGraphicsRenderer = function (engine) {
  this.type = "BitmapGraphics";
  this.engine = engine;
}

BitmapGraphicsRenderer.prototype.startup = function () {
  var bitmapLayer = new PIXI.DisplayObjectContainer();
  World.addChild(bitmapLayer);
  this.local_data = {
    bitmapLayer: bitmapLayer,
    sprites: {}
  };
}

BitmapGraphicsRenderer.prototype.render = function (frame) {
  for (var i in frame.entities) {
    var ent = frame.entities[i];
    var pos, bmp;
    if ((bmp = ent["BitmapGraphics"]) && (pos = ent["Position"])) {
      if (this.local_data.sprites[ent._id]) {
        this.setProperties(this.local_data.sprites[ent._id], pos);
      } else {
        var sprite = PIXI.Sprite.fromImage(bmp.imageUrl);
        if (bmp.centered) {
          sprite.anchor.x = 0.5;
          sprite.anchor.y = 0.5;
        }
        this.setProperties(sprite, pos);
        this.local_data.sprites[ent._id] = sprite;
        sprite.owner = this.type;
        this.local_data.bitmapLayer.addChild(sprite);
      }
    }
  }
  for (var i in this.local_data.sprites) {
    if (!frame.entities[i]) {
      this.local_data.bitmapLayer.removeChild(this.local_data.sprites[i]);
      delete this.local_data.sprites[i];
    }
  }
}

BitmapGraphicsRenderer.prototype.setProperties = function (sprite, pos) {
  sprite.rotation = pos.rotation;
  sprite.position.x = pos.position.x;
  sprite.position.y = pos.position.y;
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
  // Assuming these don't change at runtime for now
  this.imageUrl = imageUrl;
  this.centered = centered;
}

LinkageComponent = function (radius, active, isRoot, isLinked, linkedEntities) {
  this.type = "Linkage";
  this.radius = radius;
  this.active = active;
  this.isRoot = isRoot||false;
  this.isLinked = isLinked||false;
  this.linkedEntities = linkedEntities||[];
}

AttackComponent = function (damage, radius, regen, speed, barrelLength, bulletImage, charge) {
  this.type = "Attack";
  this.damage = damage;
  this.radius = radius;
  this.regen = regen;
  this.speed = speed;
  this.barrelLength = barrelLength;
  this.bulletImage = bulletImage;
  this.charge = charge || 0;
}

BulletComponent = function (target, damage, vx, vy) {
  this.type = "Bullet";
  this.target = target;
  this.damage = damage;
  this.vx = vx;
  this.vy = vy;
}

HealthComponent = function (max, regen, hp) {
  this.type = "Health";
  this.max = max;
  this.regen = regen;
  this.hp = hp||max;
}

MiningComponent = function (rate, radius) {
  this.type = "Mining";
  this.rate = rate;
  this.radius = radius;
}

ColorComponent = function (color) {
  this.type = "Color";
  this.color = color;
}

//--------

PlaceTowerCommand = function (data, color, time) {
  this._time = time || (performance.now() - game_start_time);
  this.game_id = game_handle._id;
  this.type = "PlaceTower";
  this.color = color;
  this.data = data;
}

MultiplyRotationRateCommand = function (data, color, time) {
  this._time = time || (performance.now() - game_start_time);
  this.game_id = game_handle._id;
  this.type = "MultiplyRotationRate";
  this.color = "Neutral";
  this.data = data;
}

//------------------------
// Game utils

Utils = {};

Utils.deepCopy = function (obj) {
  return JSON.parse(JSON.stringify(obj));
}

Utils.mousePoint = function (evt) {
  return new PIXI.Point(evt.offsetX - world_offset_x, evt.offsetY - world_offset_y);
}

Utils.deterministicConcat = function (str1, str2) {
  if (str1 > str2) {
    return str1 + str2;
  }
  return str2 + str1;
}

Utils.anyMatchInArray = function (target, toMatch) { // by user Ian on StackOverflow (some slight modification)
    var found, targetMap, i, j, cur;

    found = false;
    targetMap = {};

    // Put all values in the `target` array into a map, where
    //  the keys are the values from the array
    for (i = 0, j = target.length; i < j; i++) {
        cur = target[i];
        targetMap[cur] = true;
    }

    // Loop over all items in the `toMatch` array and see if any of
    //  their values are in the map from before
    for (i = 0, j = toMatch.length; !found && (i < j); i++) {
        cur = toMatch[i];
        found = !!targetMap[cur];
        // If found, `targetMap[cur]` will return true, otherwise it
        //  will return `undefined`...that's what the `!!` is for
    }

    return found;
};

Colors = {
  1: "Red",
  2: "Blue",
  screenColors: {
    "Red": 0xFF5000,
    "Blue": 0x0070FF
  },
  pastelColors: {
    "Red": 0xFFC577,
    "Blue": 0x78AFF7
  },
  numColors: 2
};

Colors.other = function (c) {
  return this[(this.number(c)) % 2 + 1];
}

Colors.number = function (c) {
  if (c == this[1]) {
    return 1;
  }
  return 2;
}

Colors.forEachColor = function (fn) {
  for (var i = 1; i <= this.numColors; i++) {
    fn(this[i], i);
  }
}

Geometry = {};

Geometry.add = function (pt1, pt2) {
  return new PIXI.Point(pt1.x + pt2.x, pt1.y + pt2.y);
}

Geometry.subtract = function (pt1, pt2) {
  return new PIXI.Point(pt1.x - pt2.x, pt1.y - pt2.y);
}

Geometry.sign = function (x) {
  return x / Math.abs(x);
}

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

Geometry.rotationFromUp = function (pt1, pt2) {
  var vdiff = Geometry.subtract(pt2, pt1);
  var length = Geometry.distance(new PIXI.Point(), vdiff);
  return Math.acos(-vdiff.y/length) * Geometry.sign(vdiff.x);
}

Geometry.segmentArea = function (angle, radius, major) {
  if (major) {
    angle = 2 * Math.PI - angle;
  }
  return (Math.pow(radius, 2)/2) * (angle - Math.sin(angle));
}

Geometry.circleOverlap = function (pt1, r1, pt2, r2) {
  if (r2 < r1) {
    var temp = r1;
    r1 = r2;
    r2 = temp;
  }
  var d2 = Geometry.distanceSquared(pt1, pt2);
  var d = Math.sqrt(d2);
  if (d >= r1 + r2) {
    return 0;
  } else if (d <= r1 - r2) {
    return Math.pow(r2, 2) * Math.PI;
  }
  // see http://mathworld.wolfram.com/Circle-CircleIntersection.html
  // c is half the radical chord length
  var c = Math.sqrt((r1 + r2 + d) * (r1 + r2 - d) * (r1 - r2 - d) * (r2 - r1 - d)) / (2 * d);
  if (d2 > Math.pow(r1, 2) - Math.pow(c, 2)) {
    return Geometry.segmentArea(2 * Math.asin(c/r1), r1) + Geometry.segmentArea(2 * Math.asin(c/r2), r2);
  } else {
    return Geometry.segmentArea(2 * Math.asin(c/r1), r1) + Geometry.segmentArea(2 * Math.asin(c/r2), r2, true);
  }
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
E.addSystems(new TowerLinkageSystem(E), new ResourcesSystem(E), new PlaceTowerSystem(E), new AttackSystem(E),
             new TowerSelectionSystem(E), new BitmapGraphicsRenderer(E), new HealthSystem(E),
             new BulletSystem(E), new DestroyDeadSystem(E));
Template.game.events(E.gatherEvents()); //Yes!

Meteor.startup(
  function () {
    Meteor.subscribe("players");
    Meteor.subscribe("games");
    Meteor.subscribe("commands");
    Meteor.subscribe("chat");

    var player_id = Players.insert({name: 'anonymous', status: 0});
    Session.set("player_id", player_id);
    Session.set("client_color", 0);
    Meteor.call('register_player_connection', player_id);
    Session.set("name", "anonymous");


    //E.tick();
    //Meteor.setInterval(function(){E.tick()}, 1000);
  }
)
