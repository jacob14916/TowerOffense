Utils = {};

Utils.deepCopy = function (obj) {
  return JSON.parse(JSON.stringify(obj));
}

Utils.offsetPoint = function (pt) {
  return new PIXI.Point(pt.x - World.position.x, pt.y - World.position.y);
}

Utils.mousePoint = function (evt) {
  return new PIXI.Point(evt.offsetX - World.position.x, evt.offsetY - World.position.y);
}

Utils.positionToString = function (pos) {
  return "Posx" + pos.x.toString(16) + "y" + pos.y.toString(16);
}

Utils.stringToPosition = function (str) {
  var coords = str.slice(4).split("y");
  return new PIXI.Point(parseInt(coords[0], 16), parseInt(coords[1], 16));
}

Utils.deterministicConcat = function (str1, str2) {
  if (str1 > str2) {
    return str1 + str2;
  }
  return str2 + str1;
}

Utils.keysObj = function (obj) {
  var keys = {};
  for (var i in obj) {
    keys[i] = true;
  }
  return keys;
}

Utils.anyMatchInArray = function (target, toMatch) { // by user Ian on StackOverflow (some slight modification)
  var found, targetMap, i, j, cur;

  found = false;
  targetMap = {};

  // Put all values in the `target` array into a map, where
  //  the keys are the values from the array
  for (i = 0, j = target.length; i < j; i++) {
    cur = target[i];
    targetMap[cur] = true;
  }

  // Loop over all items in the `toMatch` array and see if any of
  //  their values are in the map from before
  for (i = 0, j = toMatch.length; !found && (i < j); i++) {
    cur = toMatch[i];
    found = !!targetMap[cur];
    // If found, `targetMap[cur]` will return true, otherwise it
    //  will return `undefined`...that's what the `!!` is for
  }

  return found;
};

Utils.removeChildrenExcept = function (container, except) {
  var index = 0;
  for (var i = 0, len = container.children.length; i < len; i++) {
    if (except && except(container.children[index])) {
      index++;
      continue;
    }
    container.removeChild(container.children[index]);
  }
}

Utils.objDiffString = function (a, b) {
  var diffs = '';
  if (!b) return 'NOT B';
  for (var i in a) {
    if (Object.prototype.isPrototypeOf(a[i]) && Object.prototype.isPrototypeOf(b[i])) {
      var subdiff = Utils.objDiffString(a[i], b[i]);
      if (subdiff) diffs += ('[' + i + '](' + subdiff + '); ');
    } else if (typeof b[i] != typeof a[i] || a[i] !== b[i]) {
      diffs += 'a[' + i +'] = ' + a[i] + ', b[' +
        i + '] = ' + b[i] + '; ';
    }
  }
  return diffs;
}

Colors = {
  1: "Red",
  2: "Blue",
  screenColors: {
    "Red": 0xFF5000,
    "Blue": 0x0070FF
  },
  pastelColors: {
    "Red": 0xFFC577,
    "Blue": 0x78AFF7
  },
  numColors: 2
};

Colors.other = function (c) {
  return this[(this.number(c)) % 2 + 1];
}

Colors.number = function (c) {
  if (c == this[1]) {
    return 1;
  }
  return 2;
}

Colors.forEachColor = function (fn) {
  for (var i = 1; i <= this.numColors; i++) {
    fn(this[i], i);
  }
}

Geometry = {};

Geometry.add = function (pt1, pt2) {
  return new PIXI.Point(pt1.x + pt2.x, pt1.y + pt2.y);
}

Geometry.subtract = function (pt1, pt2) {
  return new PIXI.Point(pt1.x - pt2.x, pt1.y - pt2.y);
}

Geometry.floorPoint = function (pt, res) {
  res = res || 1;
  return new PIXI.Point(res * Math.floor(pt.x / res), res * Math.floor(pt.y / res));
}

Geometry.sign = function (x) {
  return x / Math.abs(x);
}

Geometry.circleRegionsDisjoint = function (c1, r1, c2, r2) {
  var sum_radii = r1 + r2;
  return Geometry.distanceSquared(c1, c2) > sum_radii * sum_radii;
}

Geometry.distance = function (pt1, pt2) {
  return Math.sqrt(Geometry.distanceSquared(pt1, pt2));
}

Geometry.distanceSquared = function (pt1, pt2) {
  var dx = pt1.x - pt2.x, dy = pt1.y - pt2.y;
  return dx * dx + dy * dy;
}

Geometry.randomAngle = function () { // Random is unacceptable for deterministic gameplay
  return Math.random() * 2 * Math.PI;
}

Geometry.rotateVec = function (vec, angle, center) {
  center = center || {x: 0, y: 0};
  var cos = Math.cos(angle),
      sin = Math.sin(angle);
  return Geometry.add({x: vec.x * cos - vec.y * sin,
                       y: vec.x * sin + vec.y * cos}, center);
}

Geometry.rotate = function (pt, angle, center) {
  return Geometry.rotateVec(Geometry.subtract(pt, center), angle, center);
}

Geometry.rotationFromUp = function (pt1, pt2) {
  var vdiff = Geometry.subtract(pt2, pt1);
  var length = Geometry.distance(new PIXI.Point(), vdiff);
  return Math.acos(-vdiff.y/length) * Geometry.sign(vdiff.x);
}

Geometry.segmentArea = function (angle, radius, major) {
  if (major) {
    angle = 2 * Math.PI - angle;
  }
  return (Math.pow(radius, 2)/2) * (angle - Math.sin(angle));
}

Geometry.circleOverlap = function (pt1, r1, pt2, r2) {
  if (r2 < r1) {
    var temp = r1;
    r1 = r2;
    r2 = temp;
  }
  var d2 = Geometry.distanceSquared(pt1, pt2);
  var d = Math.sqrt(d2);
  if (d >= r1 + r2) {
    return 0;
  } else if (d <= r1 - r2) {
    return Math.pow(r2, 2) * Math.PI;
  }
  // see http://mathworld.wolfram.com/Circle-CircleIntersection.html
  // c is half the radical chord length
  var c = Math.sqrt((r1 + r2 + d) * (r1 + r2 - d) * (r1 - r2 - d) * (r2 - r1 - d)) / (2 * d);
  if (d2 > Math.pow(r1, 2) - Math.pow(c, 2)) {
    return Geometry.segmentArea(2 * Math.asin(c/r1), r1) + Geometry.segmentArea(2 * Math.asin(c/r2), r2);
  } else {
    return Geometry.segmentArea(2 * Math.asin(c/r1), r1) + Geometry.segmentArea(2 * Math.asin(c/r2), r2, true);
  }
}

LogUtils = {
  enabled: true
};

LogUtils.nth = function (n) {
  var strn = n.toString();
  if (strn.length == 2) return strn + "th";
  var lastChar = strn.charAt(strn.length - 1);
  switch (lastChar) {
    case "1":
      return strn + "st";
    case "2":
      return strn + "nd";
    case "3":
      return strn + "rd";
    default:
      return strn + "th";
  }
}

LogUtils.log = function () {
  if (this.enabled) {
    console.log.apply(console, arguments);
  }
}
