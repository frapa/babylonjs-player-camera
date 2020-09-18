import {
  Camera,
  ICameraInput,
  Mesh,
  MeshBuilder,
  Ray,
  Scene,
  StandardMaterial,
  TargetCamera,
  UniversalCamera,
  Vector3,
} from '@babylonjs/core';

const GRAVITY = -10;

export interface CameraControlsKeys {
  forward: string | Array<string>;
  backwards: string | Array<string>;
  left: string | Array<string>;
  right: string | Array<string>;
  jump: string | Array<string>;
}

export interface PlayerOptions {
  mesh?: Mesh;
  position?: Vector3;
  ellipsoid?: Vector3;
  gravity?: number;
  camera?: TargetCamera;
  controlKeys?: CameraControlsKeys;
}

export enum MovementDirection {
  NONE = 0,
  FORWARD = 1,
  BACKWARDS = -1,
}

export enum RotationDirection {
  NONE = 0,
  LEFT = 1,
  RIGHT = -1,
}

export class Player {
  private scene: Scene;
  camera: TargetCamera;
  mesh: Mesh;

  speed = 5;
  rotation_speed = 1;
  jump_speed = 5;

  private last?: Date;
  private velocity = 0;
  private vertical_velocity = 0;
  private angular_velocity = 0;
  private readonly gravity: number;

  constructor(scene: Scene, options: PlayerOptions = {}) {
    this.scene = scene;

    this.mesh = options.mesh || this.createPlayerMesh(scene);
    this.camera = options.camera || this.createCamera(scene);
    this.configureInputs();

    this.gravity = options.gravity || GRAVITY;
  }

  private createPlayerMesh(scene: Scene, options: PlayerOptions = {}): Mesh {
    const mesh = MeshBuilder.CreateBox(
      'player',
      {
        width: options.ellipsoid?.x || 1,
        height: options.ellipsoid?.y || 1,
        depth: options.ellipsoid?.z || 1,
      },
      scene
    );

    mesh.material = new StandardMaterial('player', scene);
    mesh.position = options.position || new Vector3(0, 1, 0);
    mesh.ellipsoid = options.ellipsoid || new Vector3(0.5, 0.5, 0.5);
    mesh.checkCollisions = true;

    return mesh;
  }

  private createCamera(scene: Scene): TargetCamera {
    const camera = new UniversalCamera('camera', new Vector3(0, 2, -5), scene);
    camera.parent = this.mesh;
    camera.rotation = new Vector3(0.2, 0, 0);

    return camera;
  }

  private configureInputs(options: PlayerOptions = {}) {
    this.camera.inputs.clear();
    this.camera.inputs.add(new PlayerCameraInput(this, options.controlKeys));
    this.camera.attachControl(document.getElementsByTagName('canvas')[0]);
  }

  direction(): Vector3 {
    return Vector3.Forward().rotateByQuaternionToRef(
      this.mesh!.rotation.toQuaternion(),
      Vector3.Zero()
    );
  }

  touching(): boolean {
    const ray = new Ray(this.mesh!.position, Vector3.Down(), 0.51);
    const pick = this.scene!.pickWithRay(
      ray,
      (mesh) => mesh.checkCollisions && mesh !== this.mesh,
      true
    );
    return pick?.hit || false;
  }

  move(displacement: Vector3) {
    this.mesh.moveWithCollisions(displacement);
  }

  moveForward(displacement: number) {
    this.move(this.direction().scale(displacement));
  }

  moveUp(displacement: number) {
    this.move(Vector3.Up().scale(displacement));
  }

  go(direction: MovementDirection) {
    this.velocity = direction * this.speed;
  }

  rotate(angle: number) {
    this.mesh.rotation.addInPlace(Vector3.Down().scale(angle));
  }

  turn(direction: RotationDirection) {
    this.angular_velocity = direction * this.rotation_speed;
  }

  jump() {
    if (this.touching()) {
      this.vertical_velocity += this.jump_speed;
    }
  }

  private applyGravity(elapsed: number) {
    this.vertical_velocity += this.gravity * elapsed;
    if (this.touching()) {
      this.vertical_velocity = 0;
    }
  }

  tick() {
    const now = new Date();
    if (this.last) {
      // @ts-ignore
      const elapsed = (now - this.last) / 1000;

      this.moveForward(this.velocity * elapsed);
      this.moveUp(this.vertical_velocity * elapsed);
      this.rotate(this.angular_velocity * elapsed);

      this.applyGravity(elapsed);
    }
    this.last = now;
  }
}

class PlayerCameraInput implements ICameraInput<TargetCamera> {
  // @ts-ignore
  camera: Camera;
  player: Player;

  private controlKeys?: CameraControlsKeys;

  constructor(player: Player, controlKeys?: CameraControlsKeys) {
    this.player = player;
    this.controlKeys = controlKeys;
    this.normalizeControlKeys();
  }

  private normalizeControlKeys() {
    if (!this.controlKeys) {
      this.controlKeys = {
        forward: ['ArrowUp', 'w'],
        backwards: ['ArrowDown', 's'],
        left: ['ArrowLeft', 'a'],
        right: ['ArrowRight', 'd'],
        jump: [' '],
      };
      return;
    }

    if (this.controlKeys.forward instanceof String) {
      this.controlKeys.forward = [<string>this.controlKeys.forward];
    }

    if (this.controlKeys.backwards instanceof String) {
      this.controlKeys.backwards = [<string>this.controlKeys.backwards];
    }

    if (this.controlKeys.left instanceof String) {
      this.controlKeys.left = [<string>this.controlKeys.left];
    }

    if (this.controlKeys.right instanceof String) {
      this.controlKeys.right = [<string>this.controlKeys.right];
    }

    if (this.controlKeys.jump instanceof String) {
      this.controlKeys.jump = [<string>this.controlKeys.jump];
    }
  }

  getClassName(): string {
    return 'PlayerCameraInput';
  }

  getSimpleName(): string {
    return 'player';
  }

  attachControl(element: HTMLElement, _noPreventDefault?: boolean) {
    element.addEventListener('keydown', this.onKeyDown.bind(this));
    element.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  detachControl(element: HTMLElement) {
    element.removeEventListener('keydown', this.onKeyDown);
    element.removeEventListener('keyup', this.onKeyUp);
  }

  checkInputs() {
    this.player.tick();
  }

  private onKeyDown(event: KeyboardEvent) {
    const { forward, backwards, left, right, jump } = this.controlKeys!;

    if (forward.includes(event.key)) {
      this.player.go(MovementDirection.FORWARD);
    } else if (backwards.includes(event.key)) {
      this.player.go(MovementDirection.BACKWARDS);
    } else if (left.includes(event.key)) {
      this.player.turn(RotationDirection.LEFT);
    } else if (right.includes(event.key)) {
      this.player.turn(RotationDirection.RIGHT);
    } else if (jump.includes(event.key) && !event.repeat) {
      this.player.jump();
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    const { forward, backwards, left, right } = this.controlKeys!;

    if (forward.includes(event.key) || backwards.includes(event.key)) {
      this.player.go(MovementDirection.NONE);
    } else if (left.includes(event.key) || right.includes(event.key)) {
      this.player.turn(RotationDirection.NONE);
    }
  }
}
