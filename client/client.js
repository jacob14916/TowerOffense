// Top bar templates

Template.loginbuttons.events({
  'click [value=Login]': function (evt, instance) {
    Meteor.loginWithPassword(instance.find('[name=username]').value, instance.find('[name=password]').value, function (e) {
      if (e) {LogUtils.log(e); return;}
    });
  }
})

Template.topbar.events({
  'click [value=Logout]': function (evt) {
    Meteor.logout(function (e) {
      if (e) {LogUtils.log(e); return;}
      Session.set('loggingOut', false);
      Meteor.disconnect();
    });
    Session.set('loggingOut', true);
  }
});

Template.topbar.loggingOut = function () {
  return Session.get('loggingOut');
}

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
  return (Players.findOne({_id: game.player_2})||{}).name;
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
  if (possiblegame || game_handle.playing) {
    //Games.update({_id: possiblegame._id}, {$set: {status: "playing"}});
    return;
  }
  var oldgame = Games.findOne({player_1: Session.get("player_id")});
  if (oldgame) Games.remove({_id: oldgame._id});
  Games.insert(new Game(Session.get("player_id"), pdata._id));
}

game_handle = {};
game_start_time = null;

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
    E.tick(timestamp - game_start_time);
    game_handle.loopHandle = requestAnimationFrame(anim_handler);
  }

  game_handle.loopHandle = requestAnimationFrame(anim_handler);
  game_handle.endHandle = Meteor.setInterval(function () {
    var profile = Meteor.user().profile;
    if (!E.entities.StartTower1) {
      if (E.client_color == "Red") {
        profile.losses++;
      } else {
        profile.wins++;
      }
      Meteor.users.update({_id: Meteor.user()._id}, {$set: {profile: profile}});
      end_game();
    } else if (!E.entities.StartTower2) {
      if (E.client_color == "Blue") {
        profile.losses++;
      } else {
        profile.wins++;
      }
      Meteor.users.update({_id: Meteor.user()._id}, {$set: {profile: profile}});
      end_game();
    }
  }, 1000);
  game_handle.observeHandle = observe_handle;
  game_handle._id = id;

  var pos = START_DATA[Colors.number(color)].position;
  var x = Math.floor(Renderer.width/2 - pos.x), y = Math.floor(Renderer.height/2 - pos.y);
  World.position.x = x;
  World.position.y = y;

  game_handle.playing = true;
}

end_game = function () {
  cancelAnimationFrame(game_handle.loopHandle);
  Meteor.clearInterval(game_handle.endHandle);
  Meteor.setTimeout(function () {
    game_handle.observeHandle.stop();
    game_handle.playing = false;
    E.reset();
    Games.remove({_id: game_handle._id});
    Utils.removeChildrenExcept(World);
    Renderer.render(Stage);
  }, 1000);
}

//------------------------
// Game templates

Template.game.rendered = function () {
  Stage = new PIXI.Stage(0x888888);
  World = new PIXI.DisplayObjectContainer();
  Stage.addChild(World);
  var containerdiv = this.find(".gamecontent");
  var w = window.innerWidth - 330, h =  window.innerHeight - 110;
  Renderer = PIXI.autoDetectRenderer(w, h, undefined, false, true);

  containerdiv.appendChild(Renderer.view);
  Renderer.render(Stage);
  var minX = w - WORLD_BOTTOM_RIGHT.x, minY = h - WORLD_BOTTOM_RIGHT.y;
  window.addEventListener("keydown", function (evt) {
    var x = World.position.x, y = World.position.y;
    switch (evt.which) {
      case 37: // left
      case 65: // a
        x = Math.min(-WORLD_TOP_LEFT.x, x + 20);
        break;
      case 38: // up
      case 87: // w
        y = Math.min(-WORLD_TOP_LEFT.y, y + 20);
        break;
      case 39: // right
      case 68: // d
        x = Math.max(minX, x - 20);
        break;
      case 40: // down
      case 83: // s
        y = Math.max(minY, y - 20);
        break;
      case 81: // q
        var pos = START_DATA[Colors.number(E.client_color)].position;
        x = Math.floor(Renderer.width/2 - pos.x);
        y = Math.floor(Renderer.height/2 - pos.y);
    }
    World.position.x = x;
    World.position.y = y;
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

Template.gameui.towertype = function () {
  return Session.get("tower_type");
}

Template.gameui.seltowerurl = function () {
  var towerUrl = Session.get("seltower_url");
  return (towerUrl && E.active)?towerUrl:"PylonRed.png";
}

Template.gameui.towercost = function () {
  return Session.get("tower_cost");
}

Template.gameui.towertypes = function () {
  return _.filter(TOWER_DATA, function () {return true;});
}

Template.towerimg.created = function () {
  this.canafford = Template.towerimg.canafford.bind(this);
  this.towerurl = Template.towerimg.towerurl.bind(this);
  this.selectedborder = Template.towerimg.towerurl.bind(this);
}

Template.towerimg.towerurl = function () {
  return this.type + (E.client_color || "Red") + ".png";
}

Template.towerimg.canafford = function () {
  return (Session.get("resourceAmount") < this.cost)?0.5:1;
}

Template.towerimg.selectedborder = function () {
  return (Session.get("tower_type") == this.type)?"orange":"gray";
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


E = new Engine();
E.addSystems(new TerrainSystem(E), new TowerLinkageSystem(E), new ResourcesSystem(E), new PlaceTowerSystem(E), new AttackSystem(E),
             new TowerSelectionSystem(E), new BitmapGraphicsRenderer(E), new HealthSystem(E),
             new BulletSystem(E), new FogRenderer(E), new MinimapRenderer(E), new DestroyDeadSystem(E));
Template.game.events(E.gatherEvents()); //Yes!

Meteor.startup(
  function () {
    LogUtils.log("Starting new game @", Date());
    Meteor.subscribe("players");
    Meteor.subscribe("games");
    Meteor.subscribe("commands");
    Meteor.subscribe("chat");
    document.title = "Tower Offense";
    var previous_userid = "";
    Deps.autorun(function () {
      var user = Meteor.user();
      if (!user || previous_userid == user._id) return;
      previous_userid = user._id;
      Meteor.reconnect();
      var player_id = Players.insert({name: user.username, status: 0});
      Session.set("player_id", player_id);
      Session.set("client_color", 0);
      Meteor.call('register_player_connection', player_id);
      Session.set("name", user.username);
    });

    Games.find().observe({
      removed: function (doc) {
        LogUtils.log(doc._id, "removed; game handle.playing", game_handle.playing);
        if (game_handle.playing && doc._id == game_handle._id) {
          LogUtils.log(doc._id, "removed; game ended");
          end_game();
        }
      }
    });
  }
)
