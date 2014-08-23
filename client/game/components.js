PositionComponent = function (position, rotation) {
  this.type = "Position";
  this.position = position;
  this.rotation = rotation;
}

TowerRotationComponent = function (factor) {
  this.type = "TowerRotation";
  this.factor = factor;
}

FootprintComponent = function (radius) {
  this.type = "Footprint";
  this.radius = radius;
}

BitmapGraphicsComponent = function (imageUrl, centered) {
  this.type = "BitmapGraphics";
  // Assuming these don't change at runtime for now
  this.imageUrl = imageUrl;
  this.centered = centered;
}

LinkageComponent = function (radius, active, isRoot, isLinked, linkedEntities) {
  this.type = "Linkage";
  this.radius = radius;
  this.active = active;
  this.isRoot = isRoot||false;
  this.isLinked = isLinked||false;
  this.linkedEntities = linkedEntities||[];
}

AttackComponent = function (damage, radius, regen, speed, barrelLength, bulletImage, charge, target) {
  this.type = "Attack";
  this.damage = damage;
  this.radius = radius;
  this.regen = regen;
  this.speed = speed;
  this.barrelLength = barrelLength;
  this.bulletImage = bulletImage;
  this.charge = charge || 0;
  this.target = target || null;
  this.num_fired = 0;
}

BulletComponent = function (target, damage, vx, vy, dx, dy, sx, sy) {
  this.type = "Bullet";
  this.target = target;
  this.damage = damage;
  this.vx = vx; // velocity
  this.vy = vy;
  this.dx = dx; // distance
  this.dy = dy;
  this.sx = sx; // start
  this.sy = sy;
}

HealthComponent = function (max, regen, hp) {
  this.type = "Health";
  this.max = max;
  this.regen = regen;
  this.hp = hp||max;
}

MiningComponent = function (cRate, vRate, radius, miningFrom) {
  this.type = "Mining";
  this.cRate = cRate;
  this.vRate = vRate;
  this.radius = radius;
  this.miningFrom = miningFrom || [];
}

CostComponent = function (cost) {
  this.type = "Cost";
  this.cost = cost;
}

SightComponent = function (radius) {
  this.type = "Sight";
  this.radius = radius;
}

ColorComponent = function (color) {
  this.type = "Color";
  this.color = color;
}

ExtrapolationComponent = function (rates) {
  this.type = "Extrapolation";
  this.rates = rates;
}

//--------

PlaceTowerCommand = function (data, color, time) {
  this._time = time || (performance.now() - game_start_time);
  this.game_id = game_handle._id;
  this.type = "PlaceTower";
  this.color = color;
  this.data = data;
}

SalvageTowerCommand = function (data, color, time) {
  this._time = time || (performance.now() - game_start_time);
  this.game_id = game_handle._id;
  this.type = "SalvageTower";
  this.color = color;
  this.data = data;
}

AssignTargetCommand = function (data, color, time) {
  this._time = time || (performance.now() - game_start_time);
  this.game_id = game_handle._id;
  this.type = "AssignTarget";
  this.color = color;
  this.data = data;
}
