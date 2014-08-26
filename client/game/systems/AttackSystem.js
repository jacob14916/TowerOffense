AttackSystem = function (engine) {
  this.engine = engine;
  this.type = "Attack";
  this.startup_index = 4;
}

AttackSystem.prototype.startup = function () {
  var rangeLayer = new PIXI.DisplayObjectContainer();
  var rangeGraphics = {};
  Colors.forEachColor(function (color, i) {
    rangeGraphics[color] = new PIXI.Graphics();
    rangeLayer.addChild(rangeGraphics[color]);
  });
  World.addChild(rangeLayer);
  this.local_data = {
    rangeLayer: rangeLayer,
    rangeGraphics: rangeGraphics,
    dirty: false
  };
}

AttackSystem.scoreTarget = function (ent_pos, ent_attack, tgt) { // lower is better
  var lnk = tgt["Linkage"]; // no unlinked enemies yet
  if (lnk.isRoot) return 0;
  var score = 100;
  score += Geometry.distance(ent_pos, tgt["Position"].position) / 10;
  if (!lnk.isLinked) return score;
  if (lnk.active) {
    score -= lnk.linkedEntities.length * 2;
  }
  if (tgt["Attack"]) {
    score -= 20;
    score -= 2 * tgt["Attack"].damage * tgt["Attack"].regen;
    score -= tgt["Attack"].charge * 4;
  }
  score -= tgt["Health"].max / 10;
  if (tgt["Health"].hp >= (ent_attack.damage - 5)) {
    score -= 15; // non overkill bonus
    score += tgt ["Health"].hp * 10 / tgt["Health"].max;
  }
  return score;
}

AttackSystem.prototype.matches = function (ent) {
  return ent["Position"] && ent["Color"] && ent["Attack"];
}

AttackSystem.prototype.tick = function (ents, delta, wasChange) { // smarter algorithm later
  var delta_secs = delta / 1000;
  this.local_data.dirty = wasChange||this.local_data.dirty;
  for (var i in ents) {
    var ent = ents[i];
    if (!(ent["Linkage"].isLinked || ent["Linkage"].isRoot)) continue;
    var attack = ent["Attack"];
    if (attack.charge < 1) {
      attack.charge += attack.regen[attack.num_fired % attack.regen.length] * delta_secs;
    }
    if (attack.charge >= 1) {
      var ent_color = ent["Color"].color, ent_pos = ent["Position"].position, r2 = Math.pow(attack.radius, 2);
      var target = this.engine.entities[attack.target] || this.engine.bestEntity(function (tgt) {
        return (tgt["Color"] && tgt["Position"] && tgt["Health"] &&
                tgt["Color"].color != ent_color &&
                (Geometry.distanceSquared(ent_pos, tgt["Position"].position) <= r2));
      }, AttackSystem.scoreTarget.bind(null, ent_pos, attack));
      if (target) {
        attack.charge -= 1;
        attack.num_fired++;
        var time_missed = attack.charge / attack.regen[attack.num_fired % attack.regen.length];
        var rot = Geometry.rotationFromUp(ent_pos, target["Position"].position);
        ent["Position"].rotation = rot;
        var cos_rot = Math.sin(rot), sin_rot = -Math.cos(rot); // all screwed up because of PIXI coords
        var x = ent_pos.x + attack.barrelLength * cos_rot, vx = attack.speed * cos_rot,
            y = ent_pos.y + attack.barrelLength * sin_rot, vy = attack.speed * sin_rot;
        var distance = Geometry.distance({x: x, y: y}, target["Position"].position) - target["Footprint"].radius;
        this.engine.createEntity([ // fire!
          new PositionComponent(new PIXI.Point(x + vx * time_missed, y + vy * time_missed), rot),
          new BulletComponent(target._id, attack.damage, vx, vy,
                              Math.abs(distance * cos_rot), Math.abs(distance * sin_rot), x, y),
          new BitmapGraphicsComponent(attack.bulletImage + ent_color + ".png", true),
          new ColorComponent(ent_color),
          new ExtrapolationComponent({'Position.position.x': vx, 'Position.position.y': vy})
        ], ent._id + attack.num_fired);
      } else {
        attack.charge = 1;
      }
    }
  }
}

AttackSystem.prototype.commandMatches = function (cmd) {
  return cmd.type == "AssignTarget";
}

AttackSystem.prototype.run = function (cmd, ents) {
  switch (cmd.type) {
    case "AssignTarget":
      var ent = ents[cmd.data.id],
          target = this.engine.entities[cmd.data.target];
      if (ent && target && Geometry.distanceSquared(ent["Position"].position, target["Position"].position) < Math.pow(ent["Attack"].radius, 2)) {
        return [{
          changeEntityComponentValue: {
            entityId: cmd.data.id,
            componentType: "Attack",
            componentField: "target",
            componentFieldValue: cmd.data.target
          }
        }];
      }
      break;
  }
}

AttackSystem.prototype.render = function (frame) {
  if (this.local_data.dirty) {
    var gfx = this.local_data.rangeGraphics;
    Colors.forEachColor(function (color) {
      gfx[color].clear();
    });
    for (var i in frame.entities) {
      var ent = frame.entities[i];
      if (this.matches(ent) && (ent["Linkage"].isLinked || ent["Linkage"].isRoot)) {
        var color = ent["Color"].color, pos = ent["Position"].position;
        gfx[color].lineStyle(3, Colors.pastelColors[ent["Color"].color], 0.3);
        gfx[color].drawCircle(pos.x, pos.y, ent["Attack"].radius);
      }
    }
  }
}

//--------

BulletSystem = function (engine) {
  this.engine = engine;
  this.type = "Bullet";
  this.startup_index = 7;
}

BulletSystem.prototype.matches = function (ent) {
  return ent["Bullet"];
}

BulletSystem.prototype.tick = function (ents, delta) {
  var delta_secs = delta/1000;
  for (var i in ents) {
    var ent = ents[i];
    var pos = ent["Position"].position, bt = ent["Bullet"];
    var target = this.engine.entities[bt.target];
    if (!target) {
      this.engine.destroyEntity(ent._id);
      continue;
    }
    pos.x += bt.vx * delta_secs;
    pos.y += bt.vy * delta_secs;
    if (Math.abs(pos.x - bt.sx) >= bt.dx && Math.abs(pos.y - bt.sy) >= bt.dy) {
      target["Health"].hp -= bt.damage;
      this.engine.destroyEntity(ent._id);
    }
  }
}
