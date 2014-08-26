// Constants

MS_PER_FRAME = 50;
GUESS_LATENCY = 100; // guess 100 ms for other client to respond

START_DATA = {
  1: {
    position: new PIXI.Point(0,-1000),
    id: "StartTower1"
  },
  2: {
    position: new PIXI.Point(0,1000),
    id: "StartTower2"
  }
}

FRAMESTACK_LEN = 200;

HB_COLOR = 0x20E020;
HB_DAMAGECOLOR = 0xFF0000;
HB_WIDTH = 48;
HB_OFFSET = 24;
HB_THICKNESS = 3;

WORLD_TOP_LEFT = new PIXI.Point(-2000, -2000);
WORLD_BOTTOM_RIGHT = new PIXI.Point(2000, 2000);
WORLD_WIDTH = 4000;
WORLD_HEIGHT = 4000;

LINK_WIDTH = 5;
LINK_ALPHA = 0.4;

START_RESOURCES = 500;
