FogRenderer = function (engine) {
  this.type = "Fog";
  this.engine = engine;
}

FogRenderer.prototype.startup = function () {
  var fogGraphics = new PIXI.Graphics();
  var fogTexture = new PIXI.RenderTexture(WORLD_WIDTH, WORLD_HEIGHT);
  var fogSprite = new PIXI.Sprite(fogTexture);
  World.addChild(fogSprite);
  fogSprite.blendMode = PIXI.blendModes.ADD;
  fogSprite.position = WORLD_TOP_LEFT.clone();
  this.local_data = {
    fogSprite: fogSprite,
    fogGraphics: fogGraphics,
    dirty: true
  };
}

FogRenderer.prototype.matches = function (ent) {
  return ent["Sight"] && ent["Position"] && ent["Linkage"] && ent["Color"] &&
    ent["Color"].color == this.engine.client_color;
}

FogRenderer.prototype.tick = function (ents, delta, wasChange) {
  if (wasChange) this.local_data.dirty = true;
}

FogRenderer.prototype.render = function (frame) {
  if (this.local_data.dirty) {
    LogUtils.log("rendering");
    var gfx = this.local_data.fogGraphics;
    gfx.clear();
    gfx.beginFill(0xffffff);
    gfx.drawRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    gfx.beginFill(0);
    for (var i in frame.entities) {
      var ent = frame.entities[i];
      if (this.matches(ent)) {
        gfx.drawCircle(ent["Position"].position.x - WORLD_TOP_LEFT.x, ent["Position"].position.y - WORLD_TOP_LEFT.y, ent["Sight"].radius);
      }
    }
    this.local_data.fogSprite.texture.render(gfx);
    this.local_data.dirty = false;
  }
}
