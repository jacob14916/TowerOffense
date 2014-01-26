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

Template.playerbutton.events({
  'click':function (evt, instance) {
    challenge_player(instance.data);
  }
});

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

Template.chat.messages = function () {
  return Chat.find().fetch().sort(function (a, b) {
    return a.date.valueOf() - b.date.valueOf(); // oldest to newest
  });
}

Template.chat.showmessage = function (msg) {
  return "<b>" + msg.player_name + "</b>: " + msg.text + "<br>";
}

Template.chat.preserve([
  ".chatinput"
]);

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

Template.game.rendered = function () {

}

//------------------------

Engine = function () {
  this.framestack = [];
  this.commands = [];
  this.systems = {};
  this.command_handlers = {};
  this.system_cache = {};
  this.system_data = {};
  this.graphics_data = {};
  this.entities = {};
}

Engine.prototype.tick = function (evt) {
  var now = new Date();
  var delta = (now - this.currentFrameTime) || 0;
  this.currentFrameTime = now;
  this.stepFrame(delta);
  this.renderFrame();
}

Engine.prototype.addEntity = function (ent) {
  this.entities[ent._id] = ent;
}

Engine.prototype.insertRemoteCommand = function (cmd) {
  var found = false;
  for (var i in this.commmands) {
    if (this.commands[i]._time < cmd._time) {
      this.commands.splice(i, 0, cmd);
      found = true;
      break;
    }
  }
  if (!found) this.commands.push(cmd);
  var amtafter = 0;
  var time;
  for (var i in this.framestack) {
    if (this.framestack[i]._time < cmd._time) {
      amtafter = i;
      time = this.framestack[i]._time;
      break;
    }
  }
  this.framestack.splice(0, amtafter);
  this.entities = $.extend({}, this.framestack[0].entities);
  this.system_data = $.extend({}, this.framestack[0].system_data);
  var timediff = this.currentFrameTime - time;
  var amt_steps = Math.floor(this.timediff / 20); // 50 frames per second
  for (var i = 0; i < amt_steps; i++) {
    this.stepFrame(20);
  }
  this.stepFrame(this.timediff % 20); // catch up
}

Engine.prototype.runFrame = function (delta) {
  var stms = this.system_cache["tick"];
  for (var i in stms) { //! very slow right now
    var sys = stms[i];
    var matching_ents = [];
    for (var e in this.entities) {
      var ent = this.entities[e];
      if (sys.matches(ent)) {
        matching_ents.push(ent);
      }
    }
    sys.tick(matching_ents, delta);
  }
}

Engine.prototype.executeCommand = function (cmd) {
  this.command_handlers[cmd.type].run(cmd);
}

Engine.prototype.stepFrame = function (delta, nodump) { // (delta in ms, *dump at end?) -> undefined
  var last_time = this.framestack[0]._time;
  var target_time = last_time + delta;
  var failed_commands = [];
  for (var i = this.commands.length - 1; i >= 0; i--) { // iterate from oldest
    var cmd = this.commands[i];
    if (cmd._time > last_time && cmd._time < last_time + delta) {
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
  this.runFrame(delta);
  if (!nodump) {
    this.dumpFrame(new Date(target_time));
  }
}

Engine.prototype.dumpFrame = function (time) { // (time to stamp) -> undefined
  var prev = this.reconstructFrame(0);
  var frame =  this.findChanged({
    _time: time,
    entities: this.entities,
    system_data: this.system_data
  }, prev || {});
  this.framestack.splice(0, 0, frame);
}

Engine.prototype.findChanged = function (after, before) { // (object with changes, object before) -> Object
  var ret = (Array.prototype.isPrototypeOf(after))?[]:{};
  for (var i in after) {
    var n_el = after[i];
    var o_el = before[i];
    if (typeof i == "string" && i.charAt(0) == "_") {
      ret[i] = n_el;
      continue;
    }
    if (n_el != o_el) {
      if (typeof n_el == "object") {
        ret[i] = this.findChanged(n_el, o_el || {});
      } else {
        ret[i] = n_el;
      }
    }
  }
  return ret;
}

Engine.prototype.reconstructFrame = function (which) { // (index to reconstruct) -> that frame, reconstructed
  if (this.framestack[which]) {
    return $.extend(true, {}, reconstructFrame(which + 1), this.framestack[which]);
  }
  return {};
}


//------------------------

Meteor.startup(
  function () {
    Meteor.subscribe("players");
    Meteor.subscribe("games");
    Meteor.subscribe("chat");

    var player_id = Players.insert({name: 'anonymous', status: 0});
    Session.set("player_id", player_id);
    Meteor.call('register_player_connection', player_id);
    Session.set("name", "anonymous");
  }
)
