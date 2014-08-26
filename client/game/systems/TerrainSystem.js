LAKE_COLOR = 0x0060a0;
FOREST_COLOR = 0x40a050;

TerrainSystem = function (engine) {
  this.type = "Terrain";
  this.engine = engine;
  this.startup_index = 1;
};

TerrainSystem.prototype.startup = function () {
  var lakes = [];

  for (var i = 0; i < 8; i++) {
    lakes.push({
      position: new PIXI.Point((i - 3.5) * 400, Math.pow(i - 3.5, 2) * 120),
      radius: 190
    }, {
      position: new PIXI.Point((i - 3.5) * 400, Math.pow(i - 3.5, 2) * -120),
      radius: 190
    });
  }
  var forests = [];
  var terrainLayer = new PIXI.DisplayObjectContainer();
  var lakeGraphics = new PIXI.Graphics(),
      forestGraphics = new PIXI.Graphics();
  lakeGraphics.beginFill(LAKE_COLOR, 1);
  forestGraphics.beginFill(FOREST_COLOR, 0.5);
  World.addChild(terrainLayer);
  terrainLayer.addChild(lakeGraphics);
  terrainLayer.addChild(forestGraphics);
  for (var i in lakes) {
    var lake = lakes[i];
    lakeGraphics.drawCircle(lake.position.x, lake.position.y, lake.radius);
  }
  for (var i in forests) {
    var forest = forests[i];
    forestGraphics.drawCircle(forest.position.x, forest.position.y, forest.radius);
  }
  this.local_data = {
    terrainLayer: terrainLayer,
    forestGraphics: forestGraphics,
    lakeGraphics: lakeGraphics,
    lakes: lakes,
    forests: forests,
    dirty: true
  };
}

TerrainSystem.prototype.matches = function () {
  return false;
}

TerrainSystem.prototype.commandMatches = function (cmd) {
  return cmd.type == "PlaceTower";
}

TerrainSystem.prototype.run = function (cmd) {
  switch (cmd.type) {
    case "PlaceTower":
      var pos = cmd.data.position,
          rad = cmd.data.footRadius || 30;
      for (var i in this.local_data.lakes) {
        var lake = this.local_data.lakes[i];
        if (Geometry.distanceSquared(pos, lake.position) < Math.pow(lake.radius + rad, 2)) return false;
      }
      return true;
  }
}
