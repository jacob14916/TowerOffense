TowerLinkageSystem = function (engine) {
  this.type = "TowerLinkage";
  this.engine = engine;
  this.startup_index = 3;
}

TowerLinkageSystem.prototype.startup = function () {
  var linkageContainer = new PIXI.DisplayObjectContainer();
  var root_ids = {}, linkageGraphics = {};
  Colors.forEachColor(function (color, i) {
    root_ids[color] = START_DATA[i].id;
    linkageGraphics[color] = new PIXI.Graphics();
    linkageGraphics[color + "Circles"] = new PIXI.Graphics();
    linkageContainer.addChild(linkageGraphics[color]);
    linkageContainer.addChild(linkageGraphics[color + "Circles"]);
  });
  World.addChild(linkageContainer);
  this.local_data = {
    linkageContainer: linkageContainer,
    linkageGraphics: linkageGraphics,
    root_ids: root_ids,
    drawnLines: {},
    drawnCircles: {},
    dirty: false
  };
}

TowerLinkageSystem.prototype.matches = function (ent) {
  return ent["Color"] && ent["Position"] && ent["Linkage"];
}

TowerLinkageSystem.prototype.tick = function (ents, delta, wasChange) {
  if (wasChange) {
    this.clearLinks(ents);
    this.local_data.dirty = true;
    var that = this;
    Colors.forEachColor(function (color, i) {
      var color_ents = _.filter(ents, function (ent) {
        return ent["Color"].color == color;
      });
      var root = ents[that.local_data.root_ids[color]];
      if (root) {
        that.link(root, color_ents);
      }
    });
  }
}

TowerLinkageSystem.prototype.link = function (root, ents) {
  var r_id = root._id,
      r_pos = root["Position"].position,
      r_linkents = root["Linkage"].linkedEntities,
      r_rad2 = Math.pow(root["Linkage"].radius, 2),
      next_roots = [];
  for (var i in ents) {
    var ent = ents[i];
    if (ent._id != r_id && Geometry.distanceSquared(ent["Position"].position, r_pos) <= r_rad2 && !(_.contains(r_linkents, ent._id))) {
      var e_link = ent["Linkage"];
      e_link.linkedEntities.push(r_id);
      r_linkents.push(ent._id);
      e_link.isLinked = true;
      if (e_link.active) {
        next_roots.push(ent);
      }
    }
  }
  for (var i in next_roots) {
    this.link(next_roots[i], ents);
  }
}

TowerLinkageSystem.prototype.clearLinks = function (ents) {
  for (var i in ents) {
    var e_link = ents[i]["Linkage"];
    e_link.linkedEntities.length = 0;
    e_link.isLinked = false;
  }
}

TowerLinkageSystem.prototype.commandMatches = function (cmd) {
  return cmd.type == "PlaceTower";
}

TowerLinkageSystem.prototype.run = function (cmd) {
  switch (cmd.type) {
    case "PlaceTower":
      return cmd.data.isRoot || !!(this.engine.findEntity(function (ent) {
        return ent["Linkage"] && ent["Position"] && ent["Color"] &&
          ent["Linkage"].active && ent["Color"].color == cmd.color &&
          (Geometry.distanceSquared(ent["Position"].position, cmd.data.position) <=
           Math.pow(ent["Linkage"].radius, 2));
      }));
  }
}

TowerLinkageSystem.prototype.render = function (frame) {
  this.local_data.drawnLines = {};
  this.local_data.drawnCircles = {};
  if (this.local_data.dirty) {
    var graphics = this.local_data.linkageGraphics, that = this;
    Colors.forEachColor(function (color, i) {
      var gfx = graphics[color];
      var cgfx = graphics[color + "Circles"];
      gfx.clear();
      gfx.lineStyle(LINK_WIDTH, Colors.pastelColors[color], 1);
      cgfx.clear();
      cgfx.beginFill(Colors.pastelColors[color], LINK_ALPHA/4);
      var root = frame.entities[that.local_data.root_ids[color]];
      if (root) {
        that.drawLines(root, frame.entities, gfx, cgfx);
      }
    });
    this.local_data.dirty = false;
  }
}

TowerLinkageSystem.prototype.drawLines = function (root, ents, graphics, cgraphics) {
  var r_linkents = root["Linkage"].linkedEntities,
      r_id = root._id,
      next_roots = [],
      r_x = root["Position"].position.x,
      r_y = root["Position"].position.y;
  graphics.moveTo(r_x, r_y);
  if (!this.local_data.drawnCircles[r_id]) {
    cgraphics.drawCircle(r_x, r_y, root["Linkage"].radius);
    this.local_data.drawnCircles[r_id] = true;
  }
  for (var i in r_linkents) {
    var ent = ents[r_linkents[i]];
    if (ent && !this.local_data.drawnLines[Utils.deterministicConcat(r_id, ent._id)]) {
      this.local_data.drawnLines[Utils.deterministicConcat(r_id, ent._id)] = true;
      graphics.lineTo(ent["Position"].position.x, ent["Position"].position.y);
      graphics.moveTo(root["Position"].position.x, root["Position"].position.y);
      if (ent["Linkage"].active) {
        next_roots.push(ent);
      }
    }
  }
  for (var i in next_roots) {
    this.drawLines(next_roots[i], ents, graphics, cgraphics);
  }
}
