import {
  Capsule,
  Cylinder,
  Environment,
  OrbitControls,
  TorusKnot,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useFrame, useThree, Vector3 } from "@react-three/fiber";
import {
  CapsuleCollider,
  euler,
  Physics,
  quat,
  RapierRigidBody,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  useRevoluteJoint,
  vec3,
} from "@react-three/rapier";
import {
  MutableRefObject,
  RefObject,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CapsuleGeometry,
  DirectionalLight,
  Group,
  Mesh,
  Object3D,
} from "three";
import { CharacterModel } from "./CharacterModel";
import Spinner from "./Spinner";
import "./styles.scss";
import { useCharacterController, useCharacterState } from "./use-character";
import {
  Multiplayer,
  useLocalPlayer,
  useOtherPlayers,
  usePlayer,
} from "./use-multiplayer";

const useMap = () => {
  return useGLTF("/trip-fellas-map-transformed.glb");
};

const RevolverJoint = ({
  body,
  position,
}: {
  body: RefObject<RapierRigidBody>;
  position: Vector3;
}) => {
  const anchor = useRef<RapierRigidBody>(null);

  useRevoluteJoint(anchor, body, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 1, 0],
  ]);

  return <RigidBody ref={anchor} position={position} />;
};

const MapNode = ({ node }: { node: Mesh }) => {
  const body = useRef<RapierRigidBody>(null);
  const rand = useRef(Math.random());

  useBeforePhysicsStep(() => {
    try {
      if (node.userData.obstacle === "swing") {
        const now = performance.now();

        body.current?.setNextKinematicRotation(
          quat().setFromEuler(
            euler({
              x: 0,
              y: 0,
              z: Math.sin((now + rand.current * 2000) / 1000),
            })
          )
        );
      }

      if (node.userData.obstacle === "slider") {
        const now = performance.now();

        body.current!.setNextKinematicTranslation(
          vec3({
            x: Math.sin((now + rand.current * 800) / 700) * 6,
            y: node.position.y,
            z: node.position.z,
          })
        );
      }
    } catch (err) {}
  });

  if (node.userData.obstacle === "revolver") {
    return (
      <>
        <RigidBody
          ref={body}
          colliders={"trimesh"}
          position={node.position}
          rotation={node.rotation}
        >
          <primitive
            object={node.clone(true)}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            receiveShadow
            castShadow
          />
        </RigidBody>
        <RevolverJoint body={body} position={node.position} />
      </>
    );
  }

  if (node.userData.obstacle === "swing") {
    return (
      <>
        <RigidBody
          ref={body}
          type={"kinematicPosition"}
          colliders={"trimesh"}
          position={node.position}
          rotation={node.rotation}
        >
          <primitive
            object={node.clone(true)}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            receiveShadow
            castShadow
          />
        </RigidBody>
      </>
    );
  }

  if (node.userData.obstacle === "slider") {
    return (
      <>
        <RigidBody
          ref={body}
          type={"kinematicPosition"}
          colliders={"trimesh"}
          position={node.position}
          rotation={node.rotation}
        >
          <primitive
            object={node.clone(true)}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            receiveShadow
            castShadow
          />
        </RigidBody>
      </>
    );
  }

  if (node.userData.physics) {
    return (
      <RigidBody
        ref={body}
        type={node.userData.type}
        colliders={node.userData.physics}
        position={node.position}
        rotation={node.rotation}
      >
        <primitive
          object={node.clone(true)}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          receiveShadow
          castShadow
        />
      </RigidBody>
    );
  }

  if (node.name === "x_goal") {
    return (
      <RigidBody
        sensor
        includeInvisible
        type="fixed"
        position={node.position}
        rotation={node.rotation}
        onIntersectionEnter={(ctx) => {
          const e = new Event("game:goal-entered");
          e.detail = ctx;
          window.dispatchEvent(e);
        }}
      >
        <primitive
          object={node.clone(true)}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          visible={false}
        />
      </RigidBody>
    );
  }

  if (node.name === "Scene" || node.name.includes("x_")) return null;

  return <primitive object={node} receiveShadow castShadow />;
};

const Map = () => {
  const map = useMap();

  const nodes = useMemo(() => {
    return Object.values(map.nodes) as Mesh[];
  }, [map]);

  return (
    <>
      {nodes.map((node) => (
        <MapNode node={node} key={node.uuid} />
      ))}
    </>
  );
};

const Character = () => {
  const map = useMap();
  const body = useRef<RapierRigidBody>(null);
  const state = useCharacterController(body, {
    maxSpeed: 0.1,
  });
  const player = useLocalPlayer();

  const capsule = useRef<Mesh>();

  const { camera } = useThree();
  const cameraTarget = useRef<Object3D>();

  const resetCharacter = () => {
    body.current?.setLinvel(vec3());
    body.current.setTranslation(map.nodes.x_player_spawn.position);
  };

  useEffect(() => {
    camera.far = 100000;

    const handleGoal = (evt) => {
      if (evt.detail.rigidBody.userData.character) {
        resetCharacter();
      }
    };
    window.addEventListener("game:goal-entered", handleGoal);

    return () => {
      window.removeEventListener("game:goal-entered", handleGoal);
    };
  }, []);

  const light = useRef<DirectionalLight>(null);
  const shadowTarget = useRef();

  useAfterPhysicsStep(() => {
    try {
      const pos = vec3(capsule.current!.getWorldPosition(vec3()));

      camera.position.lerp(vec3(pos).add({ x: 0, y: 4, z: 6 }), 0.03);
      cameraTarget.current!.position.lerp(pos, 0.1);
      camera.lookAt(cameraTarget.current!.position);

      shadowTarget.current.position.copy(pos);
      light.current!.position.copy(vec3(pos).add({ x: -20, y: 20, z: -20 }));
      light.current!.target = shadowTarget.current;

      if (body.current.translation().y < -5) {
        resetCharacter();
      }
    } catch (err) {}
  });

  useEffect(() => {
    const timer = setInterval(() => {
      player.set("player", {
        velocity: state.velocity,
        moving: state.moving,
        position: body.current!.translation(),
      });
    }, 1000 / 10);

    return () => {
      clearInterval(timer);
    };
  });

  return (
    <>
      <object3D ref={cameraTarget} />
      <object3D ref={shadowTarget} />
      <directionalLight
        ref={light}
        castShadow
        intensity={0.5}
        shadow-camera-top={50}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-bottom={-50}
        shadow-camera-size={2048}
        shadow-bias={-0.001}
      />
      <RigidBody
        enabledRotations={[false, false, false]}
        colliders={false}
        ref={body}
        position={[0, 3, 0]}
        userData={{
          character: true,
        }}
      >
        <CharacterModel state={state} />
        <Capsule ref={capsule} visible={false} args={[0.5, 2]} />
        <CapsuleCollider args={[0.5, 0.5]} position={[0, 1, 0]} />
      </RigidBody>
    </>
  );
};

const OtherPlayer = ({ id }: { id: number }) => {
  const characterState = useCharacterState();
  const getPlayer = usePlayer(id);
  const group = useRef<Group>(null);

  useFrame(() => {
    try {
      const p = getPlayer();

      if (p && p.player) {
        const { moving, velocity, position } = p.player;

        characterState.moving = moving;
        characterState.velocity = velocity;
        group.current!.position.lerp(position, 0.2);
      }
    } catch (err) {}
  });

  return (
    <group ref={group}>
      <CharacterModel state={characterState} />
    </group>
  );
};

const OtherCharacters = () => {
  const players = useOtherPlayers();

  return (
    <>
      {players.map((id) => (
        <OtherPlayer id={id} key={id} />
      ))}
    </>
  );
};

const Scene = () => {
  return (
    <group>
      <Character />
      <OtherCharacters />
      <Map />
    </group>
  );
};

export default function App() {
  return (
    <div className="App">
      <Multiplayer room="trip-fellas-1">
        <Suspense fallback={<Spinner />}>
          <Canvas flat shadows dpr={1}>
            <Environment preset="dawn" />

            <Physics timeStep={"vary"} debug>
              <Scene />
            </Physics>
          </Canvas>
        </Suspense>
      </Multiplayer>
    </div>
  );
}
