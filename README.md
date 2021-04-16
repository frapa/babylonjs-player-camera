# babylonjs-player-camera

Provides a easy to use first- and third-person camera for babylonjs

## Example usage:

```typescript
import {
  MoveEvent,
  TurnEvent,
  Player as PlayerCamera,
} from "@frapa/babylonjs-player-camera";

// Wherever you need it
const playerCamera = new PlayerCamera(this.scene, {
  position: new Vector3(0, 0, 0),
  cameraOffset: new Vector3(0, 0.7, 0),
  mesh,
  callbacks: {
    onMove: async (event: MoveEvent) => {
      ...
    },
    onTurn: async (event: TurnEvent) => {
      ...
    },
  },
});

scene.activeCamera = (this.playerCamera.camera as unknown) as Camera;
```
