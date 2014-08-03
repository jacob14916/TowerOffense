TowerSelectionSystem = function (engine) {
  this.type = "TowerSelection";
  this.engine = engine;
}

TowerSelectionSystem.prototype.startup = function () {
  var selectionSprite = PIXI.Sprite.fromImage("SelectionCircle.png");
  selectionSprite.visible = false;
  selectionSprite.anchor.x = 0.5;
  selectionSprite.anchor.y = 0.5;
  var enemySelectionSprite = PIXI.Sprite.fromImage("EnemySelectionCircle.png");
  enemySelectionSprite.visible = false;
  enemySelectionSprite.anchor.x = 0.5;
  enemySelectionSprite.anchor.y = 0.5;
  var selectionLayer = new PIXI.DisplayObjectContainer();
  World.addChild(selectionLayer);
  selectionLayer.addChild(selectionSprite);
  selectionLayer.addChild(enemySelectionSprite);
  this.local_data = {
    selectedId: null,
    enemyId: null,
    selectionSprite: selectionSprite,
    enemySelectionSprite: enemySelectionSprite,
    selectionLayer: selectionLayer
  };
}

TowerSelectionSystem.prototype.matches = function (ent) {
  return (ent._id == this.local_data.selectedId);
}

TowerSelectionSystem.prototype.events = function () {
  var that = this;
  return {
    'click .gamecontent' : function (evt) {
      if (evt.button == 0) {
        var bestEntity = E.findEntity(function (ent) {
          return (ent["Footprint"] && ent["Position"] && ent["Color"] &&
                 Geometry.distanceSquared(ent["Position"].position, Utils.mousePoint(evt)) <= Math.pow(ent["Footprint"].radius, 2));
        });
        if (bestEntity && bestEntity["Color"].color == that.engine.client_color) {
          if (bestEntity._id != that.local_data.selectedId) {
            that.local_data.enemyId = null;
            that.local_data.enemySelectionSprite.visible = false;
          }
          that.local_data.selectedId = bestEntity._id;
          Session.set("seltower_url", bestEntity["BitmapGraphics"].imageUrl);
          that.local_data.selectionSprite.visible = true;
        } else if (bestEntity && that.local_data.selectedId) {
          that.local_data.enemyId = bestEntity._id;
          that.local_data.enemySelectionSprite.visible = true;
          return new AssignTargetCommand({id: that.local_data.selectedId, target: bestEntity._id}, that.engine.client_color);
        } else if (that.local_data.selectedId) {
          that.local_data.selectedId = null;
          that.local_data.selectionSprite.visible = false;
          that.local_data.enemyId = null;
          that.local_data.enemySelectionSprite.visible = false;
        }
      }
    },
    'click [name=salvage]' : function (evt) {
      if (that.local_data.selectedId) {
        return new SalvageTowerCommand({id: that.local_data.selectedId}, that.engine.client_color);
      }
    }
  }
}

TowerSelectionSystem.prototype.render = function (frame) {
  if (this.local_data.selectedId) {
    var sel_ent = frame.entities[this.local_data.selectedId],
        enemy = frame.entities[this.local_data.enemyId],
        sSprite = this.local_data.selectionSprite,
        eSprite = this.local_data.enemySelectionSprite;
    if (sel_ent) {
      sSprite.scale.x = sSprite.scale.y = Math.max(((sel_ent["Footprint"].radius + 2) / 32), 1);
      sSprite.position.x = sel_ent["Position"].position.x;
      sSprite.position.y = sel_ent["Position"].position.y;
      sSprite.rotation = Math.sin(frame._time/400);
      if (enemy) {
        eSprite.scale.x = eSprite.scale.y = ((enemy["Footprint"].radius + 2) / 32) || 1;
        eSprite.position.x = enemy["Position"].position.x;
        eSprite.position.y = enemy["Position"].position.y;
        eSprite.rotation = Math.cos(frame._time/300);
      } else {
        this.local_data.enemyId = null;
        eSprite.visible = false;
      }
    } else {
      this.local_data.selectedId = null;
      sSprite.visible = false;
      this.local_data.enemyId = null;
      eSprite.visible = false;
    }
  }
}
