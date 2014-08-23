MINIMAP_MARGIN = 20;

MinimapRenderer = function (engine) {
  this.type = "Minimap";
  this.engine = engine;
}

MinimapRenderer.prototype.startup = function () {
  if (this.local_data && this.local_data.minimapLayer) {
    Stage.removeChild(this.local_data.minimapLayer);
  }
  var minimapLayer = new PIXI.DisplayObjectContainer();
  Stage.addChild(minimapLayer); // goes on top of World
  var minimapGraphics = new PIXI.Graphics(),
      minimapFrame = new PIXI.Graphics(),
      cameraView = new PIXI.Graphics();
  minimapLayer.addChild(minimapFrame);
  minimapLayer.addChild(minimapGraphics);
  minimapLayer.addChild(cameraView);
  minimapFrame.lineStyle(4, 0, 0.8);
  minimapFrame.beginFill(0xffffff, 0.8);
  var width = WORLD_WIDTH / 20;
  var height = WORLD_HEIGHT / 20;
  minimapFrame.drawRect(0,0,width,height);
  cameraView.lineStyle(3, 0x00c000);
  var cWidth = Math.floor(Renderer.width/20),
      cHeight = Math.floor(Renderer.height/20);
  cameraView.drawRect(0, 0, cWidth, cHeight);
  this.local_data = {
    minimapLayer: minimapLayer,
    minimapGraphics: minimapGraphics,
    cameraView: cameraView,
    minimapFrame: minimapFrame,
    width: width,
    height: height,
    cWidth: cWidth,
    cHeight: cHeight,
    dirty: true
  }
};

MinimapRenderer.prototype.matches = function (ent) {
  return ent["Position"] && ent["Linkage"];
}

MinimapRenderer.prototype.tick = function (ents, delta, wasChange) {
  if (wasChange) this.local_data.dirty = true;
}

MinimapRenderer.prototype.events = function () {
  var that = this;
  return {
    'mousemove .gamecontent': function (evt) {
      if (evt.which == 1) {
        var width = that.local_data.width,
            height = that.local_data.height,
            cWidth = that.local_data.cWidth,
            cHeight = that.local_data.cHeight,
            inRange = false;
        if (evt.offsetX < (width + MINIMAP_MARGIN) && evt.offsetY < (height + MINIMAP_MARGIN)) {
          if ((evt.offsetX - cWidth/2) < (width - cWidth) && evt.offsetX > cWidth/2) {
            World.position.x = (width/2 - (evt.offsetX - cWidth/2)) * 20;
          } if ((evt.offsetY - cHeight/2) < (height - cHeight) && evt.offsetY > cHeight/2) {
            World.position.y = (height/2 - (evt.offsetY - cHeight/2)) * 20;
          }
        }
      }
    },
    'click .gamecontent': function (evt) {
      var width = that.local_data.width,
          height = that.local_data.height,
          cWidth = that.local_data.cWidth,
          cHeight = that.local_data.cHeight;
      if ((evt.offsetX - cWidth/2) < (width - cWidth) && evt.offsetX > cWidth/2 &&
          (evt.offsetY - cHeight/2) < (height - cHeight) && evt.offsetY > cHeight/2) {
        evt.stopImmediatePropagation();
        World.position.x = ((width/2) - (evt.offsetX - cWidth/2)) * 20;
        World.position.y = (height/2 - (evt.offsetY - cHeight/2)) * 20;
      }
    }
  }
}

MinimapRenderer.prototype.render = function (frame) {
  if (this.local_data.dirty) {
    LogUtils.log("Rendering Minimap");
    var mmGraphics = this.local_data.minimapGraphics;
    mmGraphics.clear();
    var ents_to_draw = [],
        that = this;
    var friends = _.filter(frame.entities, function (ent) {
      return that.matches(ent) && ent["Color"].color == that.engine.client_color &&
        (ent["Linkage"].isLinked || ent["Linkage"].isRoot);
    });
    var enemies = _.filter(frame.entities, function (ent) {
      return that.matches(ent) && ent["Color"].color != that.engine.client_color;
    });
    for (var f in friends) {
      var friend = friends[f];
      var fpos = friend["Position"].position,
          srad2 = Math.pow(friend["Sight"].radius, 2);
      ents_to_draw.push(friend._id);
      for (var e in enemies) {
        var enemy = enemies[e];
        if (!(_.contains(ents_to_draw, enemy._id)) &&
            Geometry.distanceSquared(fpos, enemy["Position"].position) <= srad2) {
          ents_to_draw.push(enemy._id);
        }
      }
    }
    for (var i in ents_to_draw) {
      var ent = frame.entities[ents_to_draw[i]];
      if (this.matches(ent)) {
        var halfsize = Math.floor(ent["Footprint"].radius/8);
        mmGraphics.beginFill(Colors.screenColors[ent["Color"].color]);
        mmGraphics.drawRect((ent["Position"].position.x + WORLD_HEIGHT/2)/20 - halfsize, (ent["Position"].position.y + WORLD_HEIGHT/2)/20 - halfsize,
                                                2 * halfsize, 2 * halfsize);
        mmGraphics.endFill(0, 0.5);
      }
    }
    this.local_data.dirty = false;
  }
  this.local_data.cameraView.position = new PIXI.Point(
    this.local_data.width/2 - World.position.x/20,
    this.local_data.height/2 - World.position.y/20
  );
}
