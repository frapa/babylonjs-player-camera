import { Engine, Scene } from '@babylonjs/core';
import test from 'ava';

import { Player, PlayerOptions } from './player';

function player(options?: PlayerOptions): Player {
  const canvas = <HTMLCanvasElement>document.createElement('canvas');
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  return new Player(scene, options);
}

test('create_player', (t) => {
  player();
  t.pass();
});
