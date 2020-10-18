import {
  Camera,
  ICameraInput,
  Mesh,
  MeshBuilder,
  Quaternion,
  Ray,
  Scene,
  StandardMaterial,
  TargetCamera,
  UniversalCamera,
  Vector2,
  Vector3,
} from '@babylonjs/core';

const GRAVITY = -10;

export interface CameraControls {
  moveForwardKeys?: string | Array<string>;
  moveBackwardKeys?: string | Array<string>;
  moveLeftKeys?: string | Array<string>;
  moveRightKeys?: string | Array<string>;
  turnLeftKeys?: string | Array<string>;
  turnRightKeys?: string | Array<string>;
  jumpKeys?: string | Array<string>;
  turnWithMouse?: boolean;
}

const EMPTY_CONTROLS = {
  moveForwardKeys: [],
  moveBackwardKeys: [],
  moveLeftKeys: [],
  moveRightKeys: [],
  turnLeftKeys: [],
  turnRightKeys: [],
  jumpKeys: [],
  turnWithMouse: false,
};

export const FPS_CONTROLS = {
  moveForwardKeys: ['ArrowUp', 'w'],
  moveBackwardKeys: ['ArrowDown', 's'],
  moveLeftKeys: ['ArrowLeft', 'a'],
  moveRightKeys: ['ArrowRight', 'd'],
  jumpKeys: [' '],
  turnWithMouse: true,
};

export const RACE_CONTROLS = {
  moveForwardKeys: ['ArrowUp', 'w'],
  moveBackwardKeys: ['ArrowDown', 's'],
  turnLeftKeys: ['ArrowLeft', 'a'],
  turnRightKeys: ['ArrowRight', 'd'],
  jumpKeys: [' '],
  turnWithMouse: false,
};

export interface CameraCallbacks {
  onMove?: (event: MoveEvent) => void;
  onMoveChange?: (event: MoveChangeEvent) => void;
  onTurn?: (event: TurnEvent) => void;
  onTurnChange?: (event: TurnChangeEvent) => void;
  onJump?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface MoveEvent {
  position: Vector3;
  delta: Vector3;
}

export interface MoveChangeEvent {
  forward: ForwardMovementDirection;
  sidewise: SidewiseMovementDirection;
}

export interface TurnEvent {
  rotation: Vector3;
  delta: Vector3;
}

export interface TurnChangeEvent {
  direction: RotationDirection;
}

export interface PlayerOptions {
  mesh?: Mesh;
  position?: Vector3;
  rotation?: Quaternion;
  cameraOffset?: Vector3;
  ellipsoid?: Vector3;
  camera?: TargetCamera;
  controls?: CameraControls;
  callbacks?: CameraCallbacks;
}

export enum ForwardMovementDirection {
  NONE = 0,
  FORWARD = 1,
  BACKWARDS = -1,
}

export enum SidewiseMovementDirection {
  NONE = 0,
  LEFT = 1,
  RIGHT = -1,
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
  rotationSpeed = 1;
  jumpSpeed = 5;
  mouseSensitivity = 12;

  private last?: Date;
  private planarVelocity = Vector2.Zero();
  private verticalVelocity = 0;
  private angularVelocity = 0;
  private readonly gravity: number = GRAVITY;

  private readonly callbacks?: CameraCallbacks;

  constructor(scene: Scene, options: PlayerOptions = {}) {
    this.scene = scene;

    this.mesh = options.mesh || this.createPlayerMesh(scene, options);
    this.camera = options.camera || this.createCamera(scene, options);
    this.configureInputs(options);

    this.callbacks = options.callbacks;
  }

  private createPlayerMesh(scene: Scene, options: PlayerOptions = {}): Mesh {
    const mesh = MeshBuilder.CreateBox(
      'player',
      {
        width: (options.ellipsoid && options.ellipsoid.x) || 1,
        height: (options.ellipsoid && options.ellipsoid.y) || 1,
        depth: (options.ellipsoid && options.ellipsoid.z) || 1,
      },
      scene
    );

    mesh.material = new StandardMaterial('player', scene);
    mesh.position =
      options.position ||
      (options.camera && options.camera.position) ||
      new Vector3(0, 1, 0);
    if (options.rotation) {
      mesh.rotation = options.rotation.toEulerAngles();
    }

    mesh.ellipsoid = options.ellipsoid || new Vector3(0.5, 0.5, 0.5);
    mesh.checkCollisions = true;

    return mesh;
  }

  private createCamera(
    scene: Scene,
    options: PlayerOptions = {}
  ): TargetCamera {
    const camera = new UniversalCamera(
      'camera',
      options.cameraOffset || Vector3.Zero(),
      scene
    );
    camera.rotation = new Vector3(0, 0, 0);

    return camera;
  }

  private configureInputs(options: PlayerOptions = {}) {
    this.camera.parent = this.mesh;
    this.camera.inputs.clear();
    this.camera.inputs.add(
      new PlayerCameraInput(this, options.controls, options.callbacks)
    );
    this.camera.attachControl(document.getElementsByTagName('canvas')[0]);
  }

  direction(): Vector3 {
    return Vector3.Forward().rotateByQuaternionToRef(
      this.camera.rotation.toQuaternion(),
      Vector3.Zero()
    );
  }

  sideDirection(): Vector3 {
    return this.direction().cross(Vector3.Up());
  }

  touching(): boolean {
    const vecs = [
      Vector3.Down(),
      Vector3.Down().rotateByQuaternionToRef(
        new Vector3(0.25, 0, 0).toQuaternion(),
        Vector3.Zero()
      ),
      Vector3.Down().rotateByQuaternionToRef(
        new Vector3(0.25, Math.PI / 3, 0).toQuaternion(),
        Vector3.Zero()
      ),
      Vector3.Down().rotateByQuaternionToRef(
        new Vector3(0.25, (2 * Math.PI) / 3, 0).toQuaternion(),
        Vector3.Zero()
      ),
      Vector3.Down().rotateByQuaternionToRef(
        new Vector3(0.25, Math.PI, 0).toQuaternion(),
        Vector3.Zero()
      ),
      Vector3.Down().rotateByQuaternionToRef(
        new Vector3(0.25, (4 * Math.PI) / 3, 0).toQuaternion(),
        Vector3.Zero()
      ),
      Vector3.Down().rotateByQuaternionToRef(
        new Vector3(0.25, (5 * Math.PI) / 3, 0).toQuaternion(),
        Vector3.Zero()
      ),
    ];
    const rays = vecs.map(
      (vec) =>
        new Ray(
          this.mesh!.position,
          vec,
          this.mesh.getBoundingInfo().boundingSphere.radius
        )
    );
    let picks = 0;
    for (const ray of rays) {
      const pick = this.scene!.pickWithRay(
        ray,
        (mesh) => mesh.checkCollisions && mesh !== this.mesh,
        true
      );
      picks += (pick && pick.hit && 1) || 0;
    }
    return picks >= 3;
  }

  move(displacement: Vector3) {
    if (Vector3.Dot(displacement, displacement) < 1e-6) return;

    const prevPosition = this.mesh.position.clone();

    this.mesh.moveWithCollisions(displacement);

    if (this.callbacks && this.callbacks.onMove) {
      this.callbacks.onMove({
        position: this.mesh.position.clone(),
        delta: this.mesh.position.subtract(prevPosition),
      });
    }
  }

  moveForward(displacement: number) {
    this.move(this.direction().scale(displacement));
  }

  moveSidewise(displacement: number) {
    this.move(this.sideDirection().scale(displacement));
  }

  moveOriented(displacement: Vector2) {
    this.move(
      this.direction()
        .scale(displacement.x)
        .add(this.sideDirection().scale(displacement.y))
    );
  }

  moveUp(displacement: number) {
    this.move(Vector3.Up().scale(displacement));
  }

  goForward(direction: ForwardMovementDirection) {
    this.planarVelocity.x = direction * this.speed;

    if (this.callbacks && this.callbacks.onMoveChange) {
      this.callbacks.onMoveChange({
        forward: direction,
        sidewise: SidewiseMovementDirection.NONE,
      });
    }
  }

  goSidewise(direction: SidewiseMovementDirection) {
    this.planarVelocity.y = direction * this.speed;

    if (this.callbacks && this.callbacks.onMoveChange) {
      this.callbacks.onMoveChange({
        forward: ForwardMovementDirection.NONE,
        sidewise: direction,
      });
    }
  }

  rotate(angle: number) {
    if (Math.abs(angle) < 1e-6) return;

    const prevRotation = this.camera.rotation.clone();

    this.camera.rotation.addInPlace(Vector3.Down().scale(angle));

    if (this.callbacks && this.callbacks.onTurn) {
      this.callbacks.onTurn({
        rotation: this.camera.rotation.clone(),
        delta: this.camera.rotation.subtract(prevRotation),
      });
    }
  }

  lookUp(angle: number) {
    if (Math.abs(angle) < 1e-6) return;

    const prevRotation = this.camera.rotation.clone();

    this.camera.rotation.addInPlace(Vector3.Left().scale(angle));

    if (this.callbacks && this.callbacks.onTurn) {
      this.callbacks.onTurn({
        rotation: this.camera.rotation.clone(),
        delta: this.camera.rotation.subtract(prevRotation),
      });
    }
  }

  turn(direction: RotationDirection) {
    this.angularVelocity = direction * this.rotationSpeed;

    if (this.callbacks && this.callbacks.onTurnChange) {
      this.callbacks.onTurnChange({ direction });
    }
  }

  jump() {
    if (this.touching()) {
      this.verticalVelocity += this.jumpSpeed;

      if (this.callbacks && this.callbacks.onJump) {
        this.callbacks.onJump();
      }
    }
  }

  private applyGravity(elapsed: number) {
    this.verticalVelocity += this.gravity * elapsed;
    // If we're jumping, do not apply stop on collision with ground
    if (this.verticalVelocity < 0 && this.touching()) {
      this.verticalVelocity = 0;
    }
  }

  tick() {
    const now = new Date();
    if (this.last) {
      // @ts-ignore
      const elapsed = (now - this.last) / 1000;

      this.moveOriented(this.planarVelocity.scale(elapsed));
      this.moveUp(this.verticalVelocity * elapsed);
      this.rotate(this.angularVelocity * elapsed);

      this.applyGravity(elapsed);
    }
    this.last = now;
  }
}

class PlayerCameraInput implements ICameraInput<TargetCamera> {
  // @ts-ignore
  camera: Camera;
  player: Player;

  private controls?: CameraControls;
  private readonly callbacks?: CameraCallbacks;

  constructor(
    player: Player,
    controls?: CameraControls,
    callbacks?: CameraCallbacks
  ) {
    this.player = player;
    this.controls = controls;
    this.callbacks = callbacks;
    this.normalizeControlKeys();
  }

  private normalizeControlKeys() {
    if (!this.controls) {
      this.controls = FPS_CONTROLS;
    }

    this.controls = { ...EMPTY_CONTROLS, ...this.controls };

    if (this.controls.moveForwardKeys instanceof String) {
      this.controls.moveForwardKeys = [<string>this.controls.moveForwardKeys];
    }

    if (this.controls.moveBackwardKeys instanceof String) {
      this.controls.moveBackwardKeys = [<string>this.controls.moveBackwardKeys];
    }

    if (this.controls.moveLeftKeys instanceof String) {
      this.controls.moveLeftKeys = [<string>this.controls.moveLeftKeys];
    }

    if (this.controls.moveRightKeys instanceof String) {
      this.controls.moveRightKeys = [<string>this.controls.moveRightKeys];
    }

    if (this.controls.turnLeftKeys instanceof String) {
      this.controls.turnLeftKeys = [<string>this.controls.turnLeftKeys];
    }

    if (this.controls.turnRightKeys instanceof String) {
      this.controls.turnRightKeys = [<string>this.controls.turnRightKeys];
    }

    if (this.controls.jumpKeys instanceof String) {
      this.controls.jumpKeys = [<string>this.controls.jumpKeys];
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

    if (this.controls.turnWithMouse) {
      element.addEventListener('click', () => {
        element.requestPointerLock();

        if (this.callbacks && this.callbacks.onFocus) {
          this.callbacks.onFocus();
        }

        if (this.callbacks && this.callbacks.onBlur) {
          document.addEventListener('pointerlockchange', () =>
            this.callbacks.onBlur()
          );
        }
      });
      element.addEventListener('mousemove', this.onMouseMove.bind(this));
    }
  }

  detachControl(element: HTMLElement) {
    element.removeEventListener('keydown', this.onKeyDown);
    element.removeEventListener('keyup', this.onKeyUp);
    document.exitPointerLock();
  }

  checkInputs() {
    this.player.tick();
  }

  private onKeyDown(event: KeyboardEvent) {
    const {
      moveForwardKeys: moveForward,
      moveBackwardKeys: moveBackward,
      moveLeftKeys: moveLeft,
      moveRightKeys: moveRight,
      turnLeftKeys: turnLeft,
      turnRightKeys: turnRight,
      jumpKeys: jump,
    } = this.controls;

    if (moveForward.includes(event.key)) {
      this.player.goForward(ForwardMovementDirection.FORWARD);
    } else if (moveBackward.includes(event.key)) {
      this.player.goForward(ForwardMovementDirection.BACKWARDS);
    } else if (moveLeft.includes(event.key)) {
      this.player.goSidewise(SidewiseMovementDirection.LEFT);
    } else if (moveRight.includes(event.key)) {
      this.player.goSidewise(SidewiseMovementDirection.RIGHT);
    } else if (turnLeft.includes(event.key)) {
      this.player.turn(RotationDirection.LEFT);
    } else if (turnRight.includes(event.key)) {
      this.player.turn(RotationDirection.RIGHT);
    } else if (jump.includes(event.key) && !event.repeat) {
      this.player.jump();
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    const {
      moveForwardKeys: moveForward,
      moveBackwardKeys: moveBackward,
      moveLeftKeys: moveLeft,
      moveRightKeys: moveRight,
      turnLeftKeys: left,
      turnRightKeys: right,
    } = this.controls;

    if (moveForward.includes(event.key) || moveBackward.includes(event.key)) {
      this.player.goForward(ForwardMovementDirection.NONE);
    } else if (moveLeft.includes(event.key) || moveRight.includes(event.key)) {
      this.player.goSidewise(SidewiseMovementDirection.NONE);
    } else if (left.includes(event.key) || right.includes(event.key)) {
      this.player.turn(RotationDirection.NONE);
    }
  }

  private onMouseMove(event: MouseEvent) {
    if (document.pointerLockElement) {
      this.player.rotate(
        -0.0001 * this.player.mouseSensitivity * event.movementX
      );
      this.player.lookUp(
        -0.0001 * this.player.mouseSensitivity * event.movementY
      );
    }
  }
}
