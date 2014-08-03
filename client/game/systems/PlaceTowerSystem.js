TOWER_TYPES = ["Pylon", "Miner", "HeavyTurret", "MachineGun", "Sniper", "Turret", "RocketTurret"];

NUM_TOWERS = 7;

TOWER_DATA = {
  Pylon: {
    type: "Pylon",
    cost: 50,
    activeLink: true,
    linkRadius: 200,
    health: 100,
    healthRegen: 4,
    footRadius: 21,
    nonattacking: true
  },
  Miner: {
    type: "Miner",
    cost: 25,
    health: 40,
    healthRegen: 1,
    mining: true,
    cRate: 5,
    vRate: 0.005,
    miningRadius: 250
  },
  HeavyTurret: {
    type: "HeavyTurret",
    cost: 250,
    health: 200,
    healthRegen: 1,
    attackRadius: 300,
    attackRegen: 0.5,
    attackDamage: 40,
    bulletSpeed: 200
  },
  MachineGun: {
    type: "MachineGun",
    cost: 200,
    health: 150,
    healthRegen: 3,
    attackRadius: 200,
    attackRegen: 4,
    attackDamage: 7,
    bulletSpeed: 400
  },
  Sniper: {
    type: "Sniper",
    cost: 300,
    health: 100,
    healthRegen: 1,
    attackRadius: 350,
    attackRegen: 1,
    attackDamage: 14,
    bulletSpeed: 500
  },
  Turret: {
    type: "Turret",
    cost: 50,
    health: 125,
    healthRegen: 2,
    attackRadius: 250,
    attackRegen: 1,
    attackDamage: 12,
    bulletSpeed: 300
  },
  RocketTurret: {
    type: "RocketTurret",
    cost: 450,
    footRadius: 48,
    health: 250,
    healthRegen: 2,
    attackRadius: 350,
    attackRegen: 0.2,
    attackDamage: 100,
    bulletSpeed: 200,
    barrelLength: 8
  }
};

PlaceTowerSystem = function (engine) {
  this.type = "PlaceTower";
  this.engine = engine;
}

PlaceTowerSystem.prototype.startup = function () {
  this.local_data = {
    footRadius: 30,
    towerIndex: 0,
  };
  var type = TOWER_TYPES[0];
  Session.set("tower_type", type);
  Session.set("tower_cost", TOWER_DATA[type].cost);
  var start_commands = [], that = this;
  Colors.forEachColor(function (color, i) {
    start_commands.push(new PlaceTowerCommand({
      position: START_DATA[i].position.clone(),
      footRadius: 48,
      cost: 0,
      type: "HQ",
      overrideId: START_DATA[i].id,
      isRoot: true,
      linkRadius: 250,
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
        var type = TOWER_TYPES[that.local_data.towerIndex];
        var data = TOWER_DATA[type];
        data.position = Utils.mousePoint(evt);
        return new PlaceTowerCommand(data, that.engine.client_color);
      }
    },
    'click [name=towertypes]' : function (evt) {
      var type = evt.target.getAttribute("towertype");
      if (!type) return;
      that.local_data.towerIndex = TOWER_TYPES.indexOf(type);
      Session.set("tower_type", type);
      Session.set("tower_cost", TOWER_DATA[type].cost);
    },
    'keydown' : function(evt) {
      var i;
      if (evt.which == 77) { // m
        i = 1;
      } else if (evt.which == 80) { // p
        i = 0;
      } else if (evt.which >= 49 && evt.which <= 55) { // number
        i = evt.which - 49;
      } else {
        return;
      }
      var type = TOWER_TYPES[i];
      that.local_data.towerIndex = i;
      Session.set("tower_type", type);
      Session.set("tower_cost", TOWER_DATA[type].cost);
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
                        new CostComponent(data.cost),
                        new SightComponent((data.attackRadius + 100) || 400),
                        new LinkageComponent(data.linkRadius, data.activeLink, data.isRoot)];
      if (!data.nonattacking) {
        components.push(new AttackComponent(data.attackDamage, data.attackRadius, data.attackRegen, data.bulletSpeed, data.barrelLength || 32, data.type + "Bullet"));
      }
      if (data.mining) {
        components.push(new MiningComponent(data.cRate, data.vRate, data.miningRadius));
      }
      return [{createEntity:
               {components: components,
                _id: data.overrideId || Utils.positionToString(pos)}}];
  }
  return false;
}
