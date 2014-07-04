Meteor.startup(
  function () {
    numConnectedUsers = 0;
    Players.remove({}); // this is for local use only - remove on deploy
  }
);

Meteor.onConnection (
  function (conn) {
    conn.onClose(function () {
      numConnectedUsers--;
      var player = Players.findOne({_conn_id: conn.id});
      if (player) {
        Games.remove({$or: [{player_1: player._id}, {player_2: player._id}]});
        Players.remove(player);
      }
    });
    numConnectedUsers++;
  }
);

Meteor.methods({
  register_player_connection : function (p_id) {
    Players.update({_id : p_id}, {$set: {_conn_id: this.connection.id}});
  },
  clear_older_chats : function (date) {
    Chat.remove({date: {$lte: date}});
  }
});

Meteor.publish("players", function () {
  return Players.find();
});

Meteor.publish("games", function () {
  return Games.find();
})

Meteor.publish("commands", function () {
  return Commands.find();
})

Meteor.publish("chat", function () {
  return Chat.find();
})
