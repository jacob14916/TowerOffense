TOWER_TYPES = ["Pylon", "Miner", "HeavyTurret", "MachineGun", "Sniper", "Turret", "RocketTurret", "PulseTurret"];

NUM_TOWERS = 8;

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
    cRate: 2,
    miningRadius: 250,
    nonattacking: true
  },
  HeavyTurret: {
    type: "HeavyTurret",
    cost: 250,
    health: 200,
    healthRegen: 2,
    attackRadius: 300,
    attackRegen: [0.45, 0.55],
    attackDamage: 40,
    bulletSpeed: 250,
    footRadius: 28
  },
  MachineGun: {
    type: "MachineGun",
    cost: 150,
    health: 200,
    healthRegen: 3,
    attackRadius: 275,
    attackRegen: [3.5, 4.5],
    attackDamage: 5,
    bulletSpeed: 400,
    footRadius: 24
  },
  Sniper: {
    type: "Sniper",
    cost: 300,
    health: 100,
    healthRegen: 1,
    attackRadius: 350,
    attackRegen: [1],
    attackDamage: 16,
    bulletSpeed: 500
  },
  Turret: {
    type: "Turret",
    cost: 50,
    health: 125,
    healthRegen: 1,
    attackRadius: 275,
    attackRegen: [1],
    attackDamage: 10,
    bulletSpeed: 400
  },
  RocketTurret: {
    type: "RocketTurret",
    cost: 400,
    footRadius: 48,
    health: 275,
    healthRegen: 2,
    attackRadius: 325,
    attackRegen: [0.25],
    attackDamage: 100,
    bulletSpeed: 200,
    barrelLength: 8
  },
  PulseTurret: {
    type: "PulseTurret",
    cost: 200,
    health: 125,
    healthRegen: 2,
    attackRadius: 300,
    attackRegen: [0.6, 4, 4],
    attackDamage: 16,
    bulletSpeed: 300,
    barrelLength: 6,
    footRadius: 25
  }
};

PlaceTowerSystem = function (engine) {
  this.type = "PlaceTower";
  this.engine = engine;
}

PlaceTowerSystem.prototype.startup = function () {
  var type = TOWER_TYPES[0];
  Session.set("tower_type", type);
  Session.set("tower_cost", TOWER_DATA[type].cost);
  var placeSprite = new PIXI.Sprite(PIXI.Texture.fromImage(type + this.engine.client_color + ".png"));
  placeSprite.visible = false;
  placeSprite.anchor.x = placeSprite.anchor.y = 0.5;
  placeSprite.alpha = 0.5;
  Stage.addChild(placeSprite);
  this.local_data = {
    footRadius: 26,
    towerIndex: 0,
    placeSprite: placeSprite
  };
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
    'mousedown .gamecontent' : function (evt) {
      if (/*evt.button == 0 && */evt.shiftKey) {
        var type = TOWER_TYPES[that.local_data.towerIndex];
        var data = TOWER_DATA[type];
        data.position = Utils.mousePoint(evt);
        return new PlaceTowerCommand(data, that.engine.client_color);
      }
    },
    'click [name=towertypes]' : function (evt) {
      var type = evt.target.getAttribute("towertype");
      if (!type) return;
      that.setTowerType(TOWER_TYPES.indexOf(type), type);
    },
    'keydown' : function(evt) {
      var i;
      if (evt.which == 90) { // z
        i = (that.local_data.towerIndex + NUM_TOWERS - 1) % NUM_TOWERS;
      } else if (evt.which == 67) { // c
        i = (that.local_data.towerIndex + 1) % NUM_TOWERS;
      } else if (evt.which == 77) { // m
        i = 1;
      } else if (evt.which == 80) { // p
        i = 0;
      } else if (Math.abs(evt.which - (49 + NUM_TOWERS/2)) <= NUM_TOWERS/2) { // number
        i = evt.which - 49;
      } else if (evt.which == 16) { // shiftKey
        that.local_data.placeSprite.visible = true;
        return;
      } else {
        return;
      }
      that.setTowerType(i);
    },
    'keyup' : function (evt) {
      if (evt.which == 16) { //shiftKey
        that.local_data.placeSprite.visible = false;
      }
    }
  }
}

PlaceTowerSystem.prototype.setTowerType = function (index, type) {
  var type = type || TOWER_TYPES[index];
  this.local_data.placeSprite.setTexture(PIXI.Texture.fromImage(type + this.engine.client_color + ".png"));
  this.local_data.towerIndex = index;
  Session.set("tower_type", type);
  Session.set("tower_cost", TOWER_DATA[type].cost);
}

PlaceTowerSystem.prototype.matches = function (ent) {
  return (ent["Position"] && ent["Footprint"]);
}

PlaceTowerSystem.prototype.commandMatches = function (cmd) {
  return (cmd.type == "PlaceTower");
}

PlaceTowerSystem.prototype.checkFootprint = function (ents, pos, fradius) {
  for (var i in ents) {
    var sumFootRadii = ents[i]["Footprint"].radius + fradius;
    if (Geometry.distanceSquared(pos, ents[i]["Position"].position) < sumFootRadii * sumFootRadii) {
      return false;
    }
  }
  return true;
}

PlaceTowerSystem.prototype.run = function (cmd, ents) {
  switch (cmd.type) {
    case "PlaceTower":
      var data = cmd.data;
      var pos = data.position, fradius = data.footRadius || this.local_data.footRadius;
      if (!this.checkFootprint(ents, pos, fradius)) return false;
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
        components.push(new AttackComponent(data.attackDamage, data.attackRadius, data.attackRegen, data.bulletSpeed, data.barrelLength || 28, data.type + "Bullet", 1));
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

PlaceTowerSystem.prototype.render = function (frame) {
  var sprite = this.local_data.placeSprite;
  if (sprite.visible) {
    var pos = Stage.getMousePosition();
    sprite.position = pos;
    var offset_pos = Utils.offsetPoint(pos);
    var fradius = TOWER_DATA[TOWER_TYPES[this.local_data.towerIndex]].footRadius || this.local_data.footRadius;
    if (this.checkFootprint(_.filter(frame.entities, this.matches), offset_pos, fradius) && _.find(frame.entities, function (ent) {
      return ent["Linkage"] && ent["Linkage"].active && (ent["Linkage"].isLinked || ent["Linkage"].isRoot) &&
        Geometry.distanceSquared(ent["Position"].position, offset_pos) <= Math.pow(ent["Linkage"].radius, 2);  // evil? (oh well)
    })) {
      sprite.tint = 0x00ff00;
    } else {
      sprite.tint = 0xff0000;
    }
  }
}
