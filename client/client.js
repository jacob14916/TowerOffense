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
  },
  'click [name=reshow]' : function () {
    var p_id = Session.get("player_id");
    var blocking_game = Games.findOne({$or: [{player_1: p_id}, {player_2: p_id}], status: "playing"});
    if (blocking_game) Games.remove({_id: blocking_game._id});
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
  if (!game) return "Click one of the players in the lobby to challenge them";
  if (game.status == "challenge") return "Pending";
  if (game.status == "declined") return "Declined";
  if (game.status == "playing") return "Accepted";
}

Template.mychallenge.events({
  'click [name=cancel]' : function () {
    var game = Games.findOne({player_1: Session.get("player_id")});
    Games.remove({_id: game._id});
  }
})

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

Meteor.startup(
  function () {
    Meteor.subscribe("players");
    Meteor.subscribe("games");

    var player_id = Players.insert({name: 'anonymous', status: 0});
    Session.set("player_id", player_id);
    Meteor.call('register_player_connection', player_id);
    Session.set("name", "anonymous");
  }
)
