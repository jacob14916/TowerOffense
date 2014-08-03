// Long Term Goal: Make well-documented
/**
* Updates model and handles commands from other client[s].
*
* @class Engine
* @constructor
*/

Engine = function () {
/**
* Object containing systems by type
*
* @property systems
* @type {Object}
* @default {}
*/
  this.systems = {};
/**
* Array of systems with "render" function
*
* @property renderers
* @type Array
* @default []
*/
  this.renderers = [];
/**
* Array of systems with "run" function
*
* @property command_handlers
* @type Array
* @default []
*/
  this.command_handlers = [];
/**
* Array of systems with "tick" function
*
* @property tickers
* @type Array
* @default []
*/
  this.tickers = [];
/**
* Array of systems in order of addition
*
* @property startup_order
* @type Array
* @default []
*/
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
  this.dumpFrame(0);
  this.tick(0);
}

Engine.prototype.reset = function () {
/**
* Array of recent frames, length capped by FRAMESTACK_LEN. Index 0 is most recent
*
* @property framestack
* @type Array
* @default []
*/
  this.framestack = []; // 0 is newest
  this.commands = []; // 0 is newest!!!
  this.system_data = {};
  this.entities = {};
  this.game_id = null;
  this.client_color = null;
  this.currentFrameTime = 0; // time = relative game time
  //this.currentFrameDate = null; // date = actual client Date
  this.active = false;
  this.system_data.was_change_since = {};
}

Engine.prototype.tick = function (delta) {
  this.stepFrame(delta);
  //this.currentFrameTime += delta;
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
    this.system_data.was_change_since[sys_type] = this.systems[sys_type].matches(ent);
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
      LogUtils.log("frame #" + i, this.framestack[i]._time, cmd._time);
      time = this.framestack[i]._time;
      break;
    }
  }
  if (cmd.time > this.currentFrameTime) {
    // the command is from the future
    return;
  }
  this.framestack.splice(0, amtafter);
  this.entities = Utils.deepCopy(this.framestack[0].entities);
  this.system_data = Utils.deepCopy(this.framestack[0].system_data);
  var timediff = this.currentFrameTime - time;
  this.currentFrameTime = time;
  var amt_steps = Math.floor(timediff / MS_PER_FRAME);
  for (var i = 0; i < amt_steps; i++) {
    this.stepFrame(MS_PER_FRAME);
    //this.currentFrameTime += MS_PER_FRAME;
  }
  this.stepFrame(timediff % MS_PER_FRAME); // catch up
  //this.currentFrameTime = time + timediff;
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
    var wasChange = this.system_data.was_change_since[sys_type];
    this.system_data.was_change_since[sys_type] = false;
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
        if (sys_ins === true) {
          continue;
        }
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

Engine.prototype.stepFrame = function (delta, skipcmds) { // (delta in ms, *dump at end?) -> undefined
  //LogUtils.log("stepFrame " + delta);
  var last_time = /*(this.framestack.length)?this.framestack[0]._time:*/this.currentFrameTime;
  var target_time = last_time + delta;
  var failed_commands = [];
  var found_cmd = false;
  if (!skipcmds) {
    for (var i = this.commands.length - 1; i >= 0; i--) { // iterate from oldest to newest
      var cmd = this.commands[i];
      if (cmd._time > last_time && cmd._time < target_time) {
        found_cmd = true;
        this.stepFrame(cmd._time - last_time, true);
        if (!this.executeCommand(cmd)) {
          LogUtils.log("Command failed");
          failed_commands.push(cmd);
        }
        this.dumpFrame(cmd._time);
        last_time = cmd._time;
      }
    }
  }
  var keyframe_time = Math.ceil(last_time / 1000) * 1000;
  if ((!found_cmd || skipcmds) && target_time > keyframe_time) {
    this.stepFrame(keyframe_time - last_time, true);
    this.dumpFrame(keyframe_time);
    last_time = keyframe_time;
  }
  /*for (var i in failed_commands) {
    this.commands.splice(this.commands.indexOf(failed_commands[i]), 1);
  }*/
  this.runFrame(target_time - last_time);
  this.currentFrameTime = target_time;
}

Engine.prototype.getFrame = function (time) {
  return {
    _time: time || this.currentFrameTime,
    entities: Utils.deepCopy(this.entities),
    system_data: Utils.deepCopy(this.system_data)
  };
}

Engine.prototype.dumpFrame = function (time) { // (time to stamp) -> undefined
  if (this.framestack.length == FRAMESTACK_LEN) {
    this.framestack.pop();
  }
  this.framestack.splice(0, 0, {
    _time: time,
    entities: Utils.deepCopy(this.entities),
    system_data: Utils.deepCopy(this.system_data)
  });
}

Engine.prototype.renderFrame = function () {
  var frame = /*this.framestack[0];*/ {
    _time: this.currentFrameTime,
    entities: this.entities,
    system_data: this.system_data
  };
  if (window.record) {
    LogUtils.log(Utils.deepCopy(frame));
  }
  for (var i in this.renderers) {
    this.systems[this.renderers[i]].render(frame);
  }
  Renderer.render(Stage);
}
