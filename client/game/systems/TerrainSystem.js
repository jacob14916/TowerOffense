LAKE_COLOR = 0x0060a0;
FOREST_COLOR = 0x40a050;

TerrainSystem = function (engine) {
  this.type = "Terrain";
  this.engine = engine;
};

TerrainSystem.prototype.startup = function () {
  var lakes = [
    {position: new PIXI.Point(), radius: 200},
    {position: new PIXI.Point(200, 0), radius: 100},
    {position: new PIXI.Point(-200, 0), radius: 100},
    {position: new PIXI.Point(800, 800), radius: 250},
    {position: new PIXI.Point(-800, -800), radius: 250},
    {position: new PIXI.Point(300, -300), radius: 200},
    {position: new PIXI.Point(-300, 300), radius: 200},
    {position: new PIXI.Point(500, -500), radius: 200},
    {position: new PIXI.Point(-500, 500), radius: 200},
    {position: new PIXI.Point(700, -500), radius: 100},
    {position: new PIXI.Point(-700, 500), radius: 100}
  ];
  var forests = [];
  for (var i in lakes) {
    forests.push({
      position: Geometry.add(lakes[i].position, {x: 350, y: 400}),
      radius: 300 - lakes[i].radius
    }, {
      position: Geometry.add(lakes[i].position, {x: -350, y: -400}),
      radius: 300 - lakes[i].radius
    });
  }
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

/*TerrainSystem.prototype.render = function () {
  if (this.local_data.)
};*/
