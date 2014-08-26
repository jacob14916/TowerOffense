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
  var that = this;
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
  this.currentSimTime = 0;
  this.active = false;
  this.system_data.was_change_since = {}; // use system_data so correct historically
}

Engine.prototype.tick = function (time) {
  this.stepFrame(this.currentFrameTime = time);
  //this.currentFrameTime += delta;
  this.render();
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
    if (this.systems[sys_type].matches(ent)) this.system_data.was_change_since[sys_type] = true;
  }
}

Engine.prototype.addSystems = function () {
  for (var i in arguments) { // order of arguments determines order of execution
    var sys = arguments[i];
    this.systems[sys.type] = sys;
    if (sys.render) this.renderers.push(sys.type);
    if (sys.run) this.command_handlers.push(sys.type);
    if (sys.tick) this.tickers.push(sys.type);
    if (sys.startup) { // to determine render layer order
      var index = this.startup_order.length;
      for (var s in this.startup_order) {
        if (!sys.startup_index || this.systems[this.startup_order[s]].startup_index > sys.startup_index) {
          index = s;
          break;
        }
      }
      this.startup_order.splice(index, 0, sys.type);
    }
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
    if (evt.pageX && !evt.offsetX) { // Firefox workaround
      evt.offsetX = evt.pageX - 300; // Inexact, but makes it usable
      evt.offsetY = evt.pageY - 170;
    }
    for (var e in sys_evt_handlers) {
      var cmd = sys_evt_handlers[e](evt, instance);
      if (cmd) {
        engine.insertCommand(cmd);
        Commands.insert(cmd);
      }
    }
  }
}

//
// Testing purposes only
Engine.prototype.checkLoop = function () {
  var that = this;
  var interval = Meteor.setInterval(function () {
    that.requestStateCheck();
  }, 1000);
  return function () {Meteor.clearInterval(interval);};
}

Engine.prototype.checkStateAgainst = function (state) {
  var frame;
  for (var i in this.framestack) {
    if (this.framestack[i]._time == state._time) {
      frame = this.framestack[i];
    }
  }
  LogUtils.log(Utils.objDiffString(state.frame, frame));
  LogUtils.log("Time diff", this.currentFrameTime - state.currentFrameTime)
}

Engine.prototype.requestStateCheck = function () {
  Commands.insert({
    _time: this.framestack[0]._time,
    frame: this.framestack[0],
    type: "CHECK_STATE",
    game_id: game_handle._id,
    color: this.client_color,
    currentFrameTime: this.currentFrameTime
  });
}
// Testing purposes only
//

Engine.prototype.insertCommand = function (cmd) {
  var i = 0;
  for (i in this.commands) {
    if (this.commands[i]._time < cmd._time) {
      break;
    }
  }
  this.commands.splice(i, 0, cmd);
}

Engine.prototype.insertRemoteCommand = function (cmd) {
  //
  // Testing purposes only
  if (cmd.type == "CHECK_STATE") {
    this.checkStateAgainst(cmd);
    return;
  }
  // Testing purposes only
  //
  this.insertCommand(cmd);
  var prev_frame_time,
      amtafter = this.framestack.length - 1;
  for (var i in this.framestack) {
    if (this.framestack[i]._time < cmd._time) {
      amtafter = i;
      prev_frame_time = this.framestack[i]._time;
      break;
    }
  }
  if (cmd._time > this.currentSimTime) {
    // the command is from the future (!)
    return;
  }
  this.framestack.splice(0, amtafter); // get rid of newly obsolete frames
  this.entities = Utils.deepCopy(this.framestack[0].entities);
  this.system_data = Utils.deepCopy(this.framestack[0].system_data);
  var old_time = this.currentSimTime;
  this.currentSimTime = prev_frame_time;
  this.stepFrame(old_time);
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

Engine.prototype.stepFrame = function (target_time, extrapolate) {
  //LogUtils.log("stepFrame " + target_time);
  var last_sim_time = this.currentSimTime; // using sim time maintains fixed internal time step
  var target_sim_time = Math.floor(target_time / MS_PER_FRAME) * MS_PER_FRAME;
  var commands = this.intervalCommands(last_sim_time, target_sim_time);
  for (var i = last_sim_time; i < target_sim_time; i += MS_PER_FRAME) {
    var prev_time = i,
        next_time = i + MS_PER_FRAME,
        step = MS_PER_FRAME;
    for (var c in commands) {
      var cmd = commands[c];
      if ((prev_time <= cmd._time) && (cmd._time < next_time)) {
        var d = cmd._time - prev_time;
        this.runFrame(d);
        this.executeCommand(cmd);
        prev_time = cmd._time;
        step -= d;
      }
    }
    this.runFrame(step);
    if (!(next_time % 1000)) this.dumpFrame(next_time); // keyframes every second
  }
  if (extrapolate) {
    this.render_frame = this.getFrame(target_sim_time);
    this.stepFrame(target_time - target_sim_time, this.render_frame);
    this.currentFrameTime = target_time;
  }
  this.currentSimTime = target_sim_time;
}

Engine.prototype.intervalCommands = function (start, end) { // [start, end)
  return _.filter(this.commands, function (cmd) {
    return (start <= cmd._time) && (cmd._time < end);
  });
}

Engine.prototype.getFrame = function (time) {
  return {
    _time: time,
    entities: Utils.deepCopy(this.entities),
    system_data: Utils.deepCopy(this.system_data)
  };
}

Engine.prototype.dumpFrame = function (time) { // (time to stamp) -> undefined
  if (this.framestack.length == FRAMESTACK_LEN) {
    this.framestack.pop();
  }
  this.framestack.splice(0, 0, this.getFrame(time));
}

Engine.prototype.extrapolateValues = function(frame, delta) {
  var delta_secs = delta/1000;
  frame.entities = $.extend({}, frame.entities); // only copy necessary objects
  for (var i in frame.entities) {
    var ent = frame.entities[i];
    if (ent["Extrapolation"]) {
      if (!ent._isCopy) ent = frame.entities[i] = $.extend({_isCopy: true}, ent); // faster than deep copy entire frame
      for (var r in ent["Extrapolation"].rates) {
        var path = r.split("."),
            containing = ent,
            p = 0;
        for (var stop = path.length - 1; p < stop; p++) {
          var key = path[p];
          if (!containing[key]._isCopy) containing[key] = $.extend({_isCopy: true}, containing[path[p]]);
          containing = containing[key];
        }
        containing[path[p]] += ent["Extrapolation"].rates[r] * delta_secs;
      }
    }
  }
}

Engine.prototype.render = function () {
  var frame = {
    _time: this.currentFrameTime,
    entities: this.entities,
    system_data: this.system_data
  };
  var timediff = this.currentFrameTime - this.currentSimTime;
  if (timediff > 1) {
    this.extrapolateValues(frame, timediff);
  }
  for (var i in this.renderers) {
    this.systems[this.renderers[i]].render(frame);
  }
  Renderer.render(Stage);
}
