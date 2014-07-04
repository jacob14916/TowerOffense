Game = function (player_1, player_2) {
  this.player_1 = player_1;
  this.player_2 = player_2;

  this.status = "challenge";
  this.player_1_end = false;
  this.player_2_end = false;
}

//------------------------

Players = new Meteor.Collection("players");
Games = new Meteor.Collection("games");
Commands = new Meteor.Collection("commands");
Chat = new Meteor.Collection("chat");

if (Meteor.isServer) {
  Players.allow(
    {insert:function(){return true;},
     update:function(){return true;}}
  );

  Games.allow(
    {insert:function(){return true;},
     update:function(){return true;},
     remove:function(){return true;}}
  );

  Chat.allow(
    {insert:function(){return true;},
     update:function(){return true;},
     remove:function(){return true;}}
  );

  Commands.allow(
    {insert: function(){return true;},
     remove: function(){return true;}}
  );
}
