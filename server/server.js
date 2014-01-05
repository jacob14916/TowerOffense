Meteor.startup(
  function () {
    Players.remove({});
    Games.remove({}); // clear out old stuff
    numConnectedUsers = 0;
  }
);

Meteor.onConnection (
  function (stuff) {
    stuff.onClose(function () {
      numConnectedUsers--;
      Players.remove({_conn_id: stuff.id});
    });
    numConnectedUsers++;
    console.log(numConnectedUsers);
  }
);

Meteor.methods({
  register_player_connection : function (p_id) {
    Players.update({_id : p_id}, {$set: {_conn_id: this.connection.id}});
  }
});

Meteor.publish("players", function () {
  return Players.find();
});

Meteor.publish("games", function () {
  return Games.find();
})
