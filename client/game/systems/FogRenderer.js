FogRenderer = function (engine) {
  this.type = "Fog";
  this.engine = engine;
}

FogRenderer.prototype.startup = function () {
  var fogLayer = new PIXI.DisplayObjectContainer(),
      fog = new PIXI.TilingSprite(PIXI.Texture.fromImage("WhitePixel.png"), WORLD_WIDTH, WORLD_HEIGHT),
      sightTexture = PIXI.Texture.fromImage("SightCircle.png");
  fog.position = WORLD_TOP_LEFT;
  fog.isFog = true;
  var fogSprite = new PIXI.Sprite(PIXI.Texture.fromImage("WhitePixel.png"));
  fogSprite.blendMode = PIXI.blendModes.ADD;
  fogSprite.position = WORLD_TOP_LEFT;
  fogLayer.addChild(fog);
  World.addChild(fogSprite);
  var that = this;
  Meteor.setTimeout(function () {
    that.local_data.dirty = true;
    Meteor.setTimeout(function () {
      that.local_data.dirty = true;
    }, 600);
  }, 400);
  this.local_data = {
    fogSprite: fogSprite,
    fogLayer: fogLayer,
    fog: fog,
    sightTexture: sightTexture,
    sightSprites: {},
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
    var sightSprites = this.local_data.sightSprites;
    var fogLayer = this.local_data.fogLayer,
        destroyed = Utils.keysObj(sightSprites);
    for (var i in frame.entities) {
      var ent = frame.entities[i];
      if (this.matches(ent)) {
        if (sightSprites[i]) {
          delete destroyed[i];
          sightSprites[i].visible = (ent["Linkage"].isLinked || ent["Linkage"].isRoot);
        } else {
          var sprite = new PIXI.Sprite(this.local_data.sightTexture);
          sprite.scale.x = sprite.scale.y = ent["Sight"].radius / 200;
          sprite.anchor.x = sprite.anchor.y = 0.5;
          sprite.position = ent["Position"].position;
          sightSprites[i] = sprite;
          fogLayer.addChild(sprite);
        }
      }
    }
    for (var d in destroyed) {
      fogLayer.removeChild(sightSprites[d]);
      delete sightSprites[d];
    }
    this.local_data.fogSprite.setTexture(fogLayer.generateTexture());
    this.local_data.dirty = false;
  }
}
