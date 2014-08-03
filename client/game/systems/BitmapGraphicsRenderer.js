BitmapGraphicsRenderer = function (engine) {
  this.type = "BitmapGraphics";
  this.engine = engine;
}

BitmapGraphicsRenderer.prototype.startup = function () {
  var bitmapLayer = new PIXI.DisplayObjectContainer();
  World.addChild(bitmapLayer);
  this.local_data = {
    bitmapLayer: bitmapLayer,
    sprites: {}
  };
}

BitmapGraphicsRenderer.prototype.render = function (frame) {
  for (var i in frame.entities) {
    var ent = frame.entities[i];
    var pos, bmp;
    if ((bmp = ent["BitmapGraphics"]) && (pos = ent["Position"])) {
      if (this.local_data.sprites[ent._id]) {
        this.setProperties(this.local_data.sprites[ent._id], pos);
      } else {
        var sprite = PIXI.Sprite.fromImage(bmp.imageUrl);
        if (bmp.centered) {
          sprite.anchor.x = 0.5;
          sprite.anchor.y = 0.5;
        }
        this.setProperties(sprite, pos);
        this.local_data.sprites[ent._id] = sprite;
        sprite.owner = this.type;
        this.local_data.bitmapLayer.addChild(sprite);
      }
    }
  }
  for (var i in this.local_data.sprites) {
    if (!frame.entities[i]) {
      this.local_data.bitmapLayer.removeChild(this.local_data.sprites[i]);
      delete this.local_data.sprites[i];
    }
  }
}

BitmapGraphicsRenderer.prototype.setProperties = function (sprite, pos) {
  sprite.rotation = pos.rotation;
  sprite.position.x = pos.position.x;
  sprite.position.y = pos.position.y;
}
