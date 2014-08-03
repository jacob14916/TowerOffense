ResourcesSystem = function (engine) {
  this.type = "Resources";
  this.engine = engine;
}

ResourcesSystem.prototype.startup = function () {
  var data = {wasCircleRemoved: false, circles: {}};
  Colors.forEachColor(function (color) {
    data["colorAmounts"+color] = 300;
  });
  var resourceLayer = new PIXI.DisplayObjectContainer(),
      circleBatch = new PIXI.SpriteBatch(),
      miningGraphics = new PIXI.Graphics(),
      circleTexture = PIXI.Texture.fromImage("ResourceCircle.png"),
      resourceGraphics = {};
  resourceLayer.addChild(miningGraphics);
  resourceLayer.addChild(circleBatch);
  var circle = function (x, y, amt) {
    return {
      position: new PIXI.Point(x, y),
      amount: amt,
      radius: Math.sqrt(amt),
      _id: Meteor.uuid()
    };
  };
  var addCircle = function (x, y, amt) {
    var c = circle(x, y, amt);
    data.circles[c._id] = c;
    var sprite = new PIXI.Sprite(circleTexture);
    resourceGraphics[c._id] = sprite;
    sprite.anchor.x = 0.5; sprite.anchor.y = 0.5;
    sprite.position = c.position;
    circleBatch.addChild(sprite);
  }
  for (var i = 0; i < 9; i++) {
    for (var j = 0; j < 9; j++) {
      addCircle((i - 4) * 300, (j - 4) * 200, 400);
    };
  }
  this.engine.system_data[this.type] = data;
  World.addChild(resourceLayer);
  this.local_data = {
    resourceLayer: resourceLayer,
    circleBatch: circleBatch,
    resourceGraphics: resourceGraphics,
    miningGraphics: miningGraphics,
    mgDirty: false,
    lastDisplayTime: 0
  };
}

ResourcesSystem.prototype.matches = function (ent) {
  return !!(ent["Mining"] && ent["Linkage"] && ent["Position"] && ent["Color"]);
}

ResourcesSystem.prototype.tick = function (ents, delta, wasChange) {
  var sys_data = this.engine.system_data[this.type];
  var circles = sys_data.circles;
  if (sys_data.empty) return;
  var delta_secs = delta / 1000,
      amounts_removed = {},
      amounts_removedbc = {};
  if (wasChange || sys_data.wasCircleRemoved) {
    LogUtils.log("wasChange", wasChange, "wasCircleRemoved", sys_data.wasCircleRemoved);
    this.local_data.mgDirty = true;
    sys_data.wasCircleRemoved = false;
    for (var i in ents) {
      var ent = ents[i];
      if (!(ent["Linkage"].isLinked || ent["Linkage"].isRoot)) {
        ent["Mining"].miningFrom = [];
        continue;
      }
      var pos = ent["Position"].position, r2 = Math.pow(ent["Mining"].radius, 2);
      ent["Mining"].miningFrom = _.pluck(_.filter(circles, function (circle) {
        return Geometry.distanceSquared(circle.position, pos) <= r2;
      }), "_id");
    }
  }
  for (var i in ents) {
    var ent = ents[i];
    var amt = ent["Mining"].cRate * delta_secs,
        color = ent["Color"].color,
        miningFrom = ent["Mining"].miningFrom;
    for (var j in miningFrom) {
      var id = miningFrom[j];
      var circle = circles[id];
      amounts_removed[id] = amounts_removed[id] + amt || amt;
      amounts_removedbc[id+color]  = amounts_removedbc[id+color] + amt || amt;
      sys_data["colorAmounts"+color] += amt;
    }
  }
  for (var i in amounts_removed) {
    var amtr = amounts_removed[i];
    if (amtr >= circles[i].amount) {
      var prop = 1 - circles[i].amount / amtr;
      Colors.forEachColor(function (color) {
        sys_data["colorAmounts"+color] -= (amounts_removedbc[i+color] || 0) * prop;
        if (Math.abs(Math.round(sys_data["colorAmounts"+color]) - sys_data["colorAmounts"+color]) < 1/0x100000) {
          sys_data["colorAmounts"+color] = Math.round(sys_data["colorAmounts"+color]);
        }
      });
      LogUtils.log(amounts_removedbc, circles[i].amount);
      delete circles[i];
      sys_data.wasCircleRemoved = true;
      sys_data.empty = $.isEmptyObject(circles);
      continue;
    }
    circles[i].amount -= amounts_removed[i];
    circles[i].radius = Math.sqrt(circles[i].amount);
  }
}

ResourcesSystem.prototype.commandMatches = function (cmd) {
  return cmd.type == "PlaceTower" || cmd.type == "SalvageTower";
}

ResourcesSystem.prototype.run = function (cmd) {
  var field = "colorAmounts" + cmd.color;
  var colorAmount = this.engine.system_data[this.type][field];
  switch (cmd.type) {
    case "PlaceTower":
      var diff = colorAmount - cmd.data.cost;
      if (diff >= 0) {
        return [{
          changeSystemDataValue: {
            systemType: this.type,
            systemDataField: field,
            systemDataFieldValue: diff
          }
        }];
      } else {
        return false;
      }
      break;
    case "SalvageTower":
      var ent = this.engine.entities[cmd.data.id];
      if (!ent) return false;
      var amt = Math.min(ent["Health"].hp / ent["Health"].max, 0.6) * ent["Cost"].cost;
      return [{
          changeSystemDataValue: {
            systemType: this.type,
            systemDataField: field,
            systemDataFieldValue: colorAmount + amt
          }
        }];
  }
}

ResourcesSystem.prototype.render = function (frame) {
  var sys_data = frame.system_data[this.type];
  var circles = sys_data.circles;
  if (!sys_data.empty || this.local_data.mgDirty) {
    var graphics = this.local_data.resourceGraphics;
    for (var i in graphics) {
      if (circles[i]) {
        graphics[i].scale.x = graphics[i].scale.y = circles[i].radius / 100;
      } else {
        graphics[i].visible = false;
        this.local_data.circleBatch.removeChild(graphics[i]);
        delete graphics[i];
      }
    }
    if (this.local_data.mgDirty) {
      var mgraphics = this.local_data.miningGraphics;
      mgraphics.clear();
      mgraphics.lineStyle(5, 0, 0.4);
      for (var i in frame.entities) {
        if (this.matches(frame.entities[i])) {
          var ent = frame.entities[i];
          var pos = ent["Position"].position,
              miningFrom = ent["Mining"].miningFrom;
          for (var j in miningFrom) {
            var circle = circles[miningFrom[j]];
            if (circle) {
              mgraphics.moveTo(pos.x, pos.y);
              mgraphics.lineTo(circle.position.x, circle.position.y);
            }
          }
        }
      }
      this.local_data.mgDirty = false;
    }
  }
  if (frame._time - this.local_data.lastDisplayTime > 500) {
    var amount = Math.floor(sys_data["colorAmounts"+this.engine.client_color]);
    if (Session.get("resourceAmount") != amount) {
      Session.set("resourceAmount", amount);
    }
    this.local_data.lastDisplayTime = frame._time;
  }
}
