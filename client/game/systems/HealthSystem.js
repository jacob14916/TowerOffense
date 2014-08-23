DestroyDeadSystem = function (engine) {
  this.type = "DestroyDead";
  this.engine = engine;
}

DestroyDeadSystem.prototype.startup = function () {
  var explosionLayer = new PIXI.DisplayObjectContainer();
  var explosionTextures = [];
  var assetLoader = new PIXI.AssetLoader(["SpriteSheet.json"]);
  assetLoader.onComplete = function () {
    for (var i = 1; i < 27; i++) {
      var texture = PIXI.Texture.fromFrame("Explosion_Sequence_A " + i + ".png");
		 	explosionTextures.push(texture);
    }
  };
  assetLoader.load();
  World.addChild(explosionLayer);
  this.local_data = {
    explosionLayer: explosionLayer,
    explosionTextures: explosionTextures,
    explosionPositions: [],
    explosionPool: []
  }
}

DestroyDeadSystem.prototype.matches = function (ent) {
  return ent["Health"] && ent["Position"] && (ent["Health"].hp <= 0);
}

DestroyDeadSystem.prototype.tick = function (ents) {
  for (var i in ents) {
    this.local_data.explosionPositions.push(ents[i]["Position"].position);
    this.engine.destroyEntity(ents[i]._id);
  }
}

DestroyDeadSystem.prototype.render = function () {
  if (this.local_data.explosionPositions.length) {
    for (var i in this.local_data.explosionPositions) {
      var sprite;
      if (this.local_data.explosionPool.length) {
        sprite = this.local_data.explosionPool.pop();
        sprite.visible = true;
      } else {
        sprite = new PIXI.MovieClip(this.local_data.explosionTextures);
        this.local_data.explosionLayer.addChild(sprite);
        sprite.loop = false;
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
      }
      sprite.position = this.local_data.explosionPositions[i];
      sprite.gotoAndPlay(0);
    }
    this.local_data.explosionPositions.length = 0;
  }
  for (var i in this.local_data.explosionLayer.children) {
    var sprite = this.local_data.explosionLayer.children[i];
    if (!sprite.playing) {
      sprite.visible = false;
      this.local_data.explosionPool.push(sprite);
    }
  }
}

//--------

HealthSystem = function (engine) {
  //$ work here next
  this.engine = engine;
  this.type = "Health";
}

HealthSystem.prototype.startup = function () {
  var hbGraphics = new PIXI.Graphics();
  var hbContainer = new PIXI.DisplayObjectContainer();
  hbContainer.addChild(hbGraphics);
  World.addChild(hbContainer);
  this.local_data = {
    hbGraphics: hbGraphics,
    hbContainer: hbContainer
  };
}

HealthSystem.prototype.matches = function (ent) {
  return ent["Position"] && ent["Health"];
}

HealthSystem.prototype.tick = function (ents, delta) {
  var delta_secs = delta / 1000;
  for (var i in ents) {
    var health = ents[i]["Health"];
    if (health.hp < health.max && health.hp > 0) {
      health.hp = Math.min(health.hp + delta_secs * health.regen, health.max);
    }
  }
}

HealthSystem.prototype.commandMatches = function (cmd) {
  return cmd.type == "SalvageTower";
}

HealthSystem.prototype.run = function (cmd) {
  switch (cmd.type) {
    case "SalvageTower":
      if (!this.engine.entities[cmd.data.id]) return false;
      return [{
        changeEntityComponentValue: {
          entityId: cmd.data.id,
          componentType: "Health",
          componentField: "hp",
          componentFieldValue: -1
        }
      }];
  }
}

HealthSystem.prototype.render = function (frame) {
  var bargfx = this.local_data.hbGraphics;
  bargfx.clear();
  bargfx.lineStyle(HB_THICKNESS, HB_COLOR, 1);
  for (var i in frame.entities) {
    var ent = frame.entities[i], health = ent["Health"];
    if (!health) {
      continue;
    }
    var ratio =  (health.hp / health.max);
    if (ratio < 1) {
      var x = ent["Position"].position.x - HB_WIDTH/2, y = ent["Position"].position.y + HB_OFFSET;
      bargfx.lineColor =  Math.floor((1-ratio) * 0xff) * 0x10000 + 0xFF00;
      bargfx.moveTo(x, y);
      bargfx.lineTo(x + ratio * HB_WIDTH, y);
      bargfx.lineColor = HB_DAMAGECOLOR;
      bargfx.moveTo(x + ratio * HB_WIDTH, y);
      bargfx.lineTo(x + HB_WIDTH, y);
    }
  }
}
