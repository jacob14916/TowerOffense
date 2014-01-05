Game = function (player_1, player_2) {
  this.player_1 = player_1;
  this.player_2 = player_2;

  this.status = "challenge";
}

//------------------------

Players = new Meteor.Collection("players");
Games = new Meteor.Collection("games");

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
}
